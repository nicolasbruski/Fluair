import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  EligibleOrderPriceListsEnvelope,
  OrderCatalogEnvelope,
  OrderCalculatedProductCatalogItem,
  OrderKitCatalogItem,
  OrderQuoteEnvelope,
  OrderQuoteLine,
  CreateOrderEnvelope,
  CreateOrderSnapshot,
  SavedCatalogMutationEnvelope,
  SavedKitCompositionEnvelope,
  OrderSavedCatalogEnvelope,
  OrderDetailsEnvelope,
  OrderDraft,
  OrderDraftEnvelope,
  OrderDraftSwapEnvelope,
  OrderLastSalePricesEnvelope,
} from '../../../shared/orders.js';
import type { AuthenticatedUser } from '../../../shared/auth.js';
import { ROLE_CODES } from '../../../shared/auth.js';
import type { OrderPriceViolation } from '../../../shared/order-price-approvals.js';
import {
  approvalContentFromQuote,
  hashOrderPriceApprovalContent,
} from '../order-price-approvals/order-price-approval-content.js';
import { isOrderQuantityInRange, orderTotalQuantity } from '../../../shared/order-quantity.js';
import { imageReference } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';
import type {
  EligibleOrderPriceListsQuery,
  OrderCatalogQuery,
  OrderQuoteCommand,
  CreateOrderCommand,
  OrderSavedCatalogQuery,
  SavedCatalogItemParams,
  UpdateSavedCatalogItemCommand,
  OrderDraftSwapCommand,
  OrderDraftSaveCommand,
  OrderLastSalePricesCommand,
} from './orders.schemas.js';
import {
  OrderPriceApprovalConsumptionConflictError,
  PrismaOrdersRepository,
  type OrdersRepository,
} from './orders.repository.js';
import {
  PrismaOrderDraftsRepository,
  type OrderDraftsRepository,
  type StoredOrderDraft,
} from './order-drafts.repository.js';
import { orderDraftPayloadSchema } from './orders.schemas.js';

type OrderCustomer = {
  id: string;
  code: string;
  legalName: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  customerClass: { id: string; code: string; name: string; active: boolean } | null;
  customerSegment: { id: string; code: string; name: string; active: boolean } | null;
};

export interface OrdersServiceOptions {
  repository?: OrdersRepository;
  draftRepository?: OrderDraftsRepository;
  quoteTokenSecret?: string;
  quoteTtlMilliseconds?: number;
  notificationRecipients?: string;
  emailFrom?: string;
  emailFromName?: string | null;
  emailReplyTo?: string | null;
  clock?: { now(): Date };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!emailPattern.test(normalized) || normalized.length > 254) {
    throw new AppError(
      422,
      'INVALID_ORDER_RECIPIENT',
      'Não foi possível validar os destinatários do pedido.',
    );
  }
  return normalized;
}

function recipients(userEmail: string, configured: string): string[] {
  const result = new Map<string, string>();
  for (const value of [userEmail, ...configured.split(',')]) {
    const email = normalizedEmail(value);
    result.set(email, email);
  }
  if (!result.size) {
    throw new AppError(
      422,
      'ORDER_RECIPIENTS_REQUIRED',
      'O pedido precisa possuir ao menos um destinatário válido.',
    );
  }
  return [...result.values()];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

type QuoteTokenPayload = {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  actorId: string | null;
  fingerprint: string;
  nonce: string;
};

export class OrdersService {
  private readonly repository: OrdersRepository;
  private readonly draftRepository: OrderDraftsRepository;
  private readonly quoteTokenSecret: string;
  private readonly quoteTtlMilliseconds: number;
  private readonly notificationRecipients: string;
  private readonly emailFrom: string;
  private readonly emailFromName: string | null;
  private readonly emailReplyTo: string | null;
  private readonly clock: { now(): Date };

  constructor(
    private readonly prisma: PrismaClient,
    options: OrdersServiceOptions = {},
  ) {
    this.repository = options.repository ?? new PrismaOrdersRepository(prisma);
    this.draftRepository = options.draftRepository ?? new PrismaOrderDraftsRepository(prisma);
    this.quoteTokenSecret = options.quoteTokenSecret ?? 'orders-local-quote-token-secret';
    this.quoteTtlMilliseconds = options.quoteTtlMilliseconds ?? 10 * 60 * 1000;
    this.notificationRecipients = options.notificationRecipients ?? 'nicolasbruski7@gmail.com';
    this.emailFrom = normalizedEmail(options.emailFrom ?? 'no-reply@localhost.invalid');
    this.emailFromName = options.emailFromName ?? null;
    this.emailReplyTo = options.emailReplyTo ? normalizedEmail(options.emailReplyTo) : null;
    this.clock = options.clock ?? { now: () => new Date() };
    // Falha cedo, antes de qualquer commit, se a configuração operacional for inválida.
    for (const value of this.notificationRecipients.split(',')) normalizedEmail(value);
  }

  private orderDraft(record: StoredOrderDraft): OrderDraft {
    return {
      id: record.id,
      revision: record.revision,
      customer: record.customer,
      payload: orderDraftPayloadSchema.parse(record.payload),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async draft(actor: AuthenticatedUser): Promise<OrderDraftEnvelope> {
    const draft = await this.draftRepository.findForUser(actor.id);
    return { data: { draft: draft ? this.orderDraft(draft) : null } };
  }

  async swapDraft(
    command: OrderDraftSwapCommand,
    actor: AuthenticatedUser,
  ): Promise<OrderDraftSwapEnvelope> {
    await this.customer(command.targetCustomerId);
    if (command.current) await this.customer(command.current.customerId);
    const result = await this.draftRepository.swap(actor.id, command);
    return {
      data: {
        restored: result.restored ? this.orderDraft(result.restored) : null,
        draft: result.draft ? this.orderDraft(result.draft) : null,
      },
    };
  }

  async saveDraft(
    command: OrderDraftSaveCommand,
    actor: AuthenticatedUser,
  ): Promise<OrderDraftEnvelope> {
    await this.customer(command.customerId);
    const draft = await this.draftRepository.save(actor.id, command);
    return { data: { draft: this.orderDraft(draft) } };
  }

  async deleteDraft(customerId: string | undefined, actor: AuthenticatedUser): Promise<void> {
    await this.draftRepository.deleteForUser(actor.id, customerId);
  }

  async lastSalePrices(command: OrderLastSalePricesCommand): Promise<OrderLastSalePricesEnvelope> {
    await this.customer(command.customerId);
    if (!command.lines.length) return { data: { prices: [] } };

    const productCodes = [
      ...new Set(
        command.lines.flatMap((line) =>
          line.kind === 'STANDALONE_PRODUCT' ? [line.productCode] : [],
        ),
      ),
    ];
    const calculationIds = [
      ...new Set(
        command.lines.flatMap((line) => (line.kind === 'KIT' ? [line.calculationId] : [])),
      ),
    ];
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: { customerId: command.customerId, status: 'SUBMITTED' },
        OR: [
          ...(productCodes.length
            ? [{ kind: 'STANDALONE_PRODUCT' as const, codeSnapshot: { in: productCodes } }]
            : []),
          ...(calculationIds.length
            ? [{ kind: 'KIT' as const, sourceCalculationVersionId: { in: calculationIds } }]
            : []),
        ],
      },
      orderBy: [{ order: { submittedAt: 'desc' } }, { lineNumber: 'desc' }],
      select: {
        kind: true,
        codeSnapshot: true,
        sourceCalculationVersionId: true,
        negotiatedUnitPrice: true,
        order: { select: { id: true, number: true, submittedAt: true } },
      },
    });

    const latestProducts = new Map<string, (typeof items)[number]>();
    const latestKits = new Map<string, (typeof items)[number]>();
    for (const item of items) {
      if (item.kind === 'STANDALONE_PRODUCT') {
        if (!latestProducts.has(item.codeSnapshot)) latestProducts.set(item.codeSnapshot, item);
      } else if (item.sourceCalculationVersionId) {
        if (!latestKits.has(item.sourceCalculationVersionId))
          latestKits.set(item.sourceCalculationVersionId, item);
      }
    }

    return {
      data: {
        prices: command.lines.map((line) => {
          const item =
            line.kind === 'STANDALONE_PRODUCT'
              ? latestProducts.get(line.productCode)
              : latestKits.get(line.calculationId);
          return {
            key: line.key,
            lastOrderPrice: item
              ? {
                  unitPrice: item.negotiatedUnitPrice.toFixed(4),
                  orderId: item.order.id,
                  orderNumber: item.order.number,
                  orderedAt: item.order.submittedAt.toISOString(),
                }
              : null,
          };
        }),
      },
    };
  }

  private async customer(customerId: string): Promise<OrderCustomer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, active: true },
      select: {
        id: true,
        code: true,
        legalName: true,
        cnpj: true,
        city: true,
        state: true,
        customerClass: { select: { id: true, code: true, name: true, active: true } },
        customerSegment: { select: { id: true, code: true, name: true, active: true } },
      },
    });
    if (!customer) {
      throw new AppError(
        404,
        'ACTIVE_CUSTOMER_NOT_FOUND',
        'O cliente selecionado não existe ou está desativado.',
      );
    }
    return customer;
  }

  private quoteFingerprint(data: OrderQuoteEnvelope['data']): string {
    return sha256(
      stableJson({
        customerId: data.customer.id,
        lines: data.lines.map((line) => ({
          kind: line.kind,
          code: line.kind === 'KIT' ? line.code : line.productCode,
          sourceId: line.kind === 'KIT' ? line.calculationId : line.priceListVersion.id,
          sourceVersion: line.priceListVersion.version,
          quantity: line.quantity,
          referenceUnitPrice: line.referenceUnitPrice,
          negotiatedUnitPrice: line.negotiatedUnitPrice,
        })),
        total: data.total,
        recipients: data.recipients,
      }),
    );
  }

  private signQuote(payload: QuoteTokenPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.quoteTokenSecret)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${signature}`;
  }

  private verifyQuoteToken(token: string, actorId: string, fingerprint: string): QuoteTokenPayload {
    const [encoded, suppliedSignature, extra] = token.split('.');
    if (!encoded || !suppliedSignature || extra) {
      throw new AppError(
        409,
        'ORDER_QUOTE_STALE',
        'A revisão do pedido expirou. Gere uma nova revisão.',
      );
    }
    const expectedSignature = createHmac('sha256', this.quoteTokenSecret)
      .update(encoded)
      .digest('base64url');
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new AppError(
        409,
        'ORDER_QUOTE_STALE',
        'A revisão do pedido mudou. Gere uma nova revisão.',
      );
    }
    let payload: QuoteTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as QuoteTokenPayload;
    } catch {
      throw new AppError(
        409,
        'ORDER_QUOTE_STALE',
        'A revisão do pedido é inválida. Gere uma nova revisão.',
      );
    }
    if (
      payload.version !== 1 ||
      !Number.isSafeInteger(payload.issuedAt) ||
      payload.actorId !== actorId ||
      payload.fingerprint !== fingerprint ||
      payload.expiresAt < this.clock.now().getTime()
    ) {
      throw new AppError(
        409,
        'ORDER_QUOTE_STALE',
        'Os dados do pedido mudaram. Revise e confirme novamente.',
      );
    }
    return payload;
  }

  async eligiblePriceLists(
    query: EligibleOrderPriceListsQuery,
  ): Promise<EligibleOrderPriceListsEnvelope> {
    const customer = await this.customer(query.customerId);
    const totalQuantity = orderTotalQuantity(query.quantities.map((quantity) => ({ quantity })));
    if (!customer.customerSegment?.active) {
      throw new AppError(
        422,
        'CUSTOMER_SEGMENT_REQUIRED',
        'O cliente não possui um segmento ativo definido para selecionar a lista.',
      );
    }
    const lists = await this.prisma.priceList.findMany({
      where: {
        type: 'STANDALONE_PRODUCT',
        active: true,
        activeVersionId: { not: null },
        segments: { some: { customerSegmentId: customer.customerSegment.id } },
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        minimumOrderQuantity: true,
        maximumOrderQuantity: true,
        activeVersion: { select: { id: true, version: true } },
      },
    });
    return {
      data: {
        customer: {
          id: customer.id,
          code: customer.code,
          legalName: customer.legalName,
          customerSegmentId: customer.customerSegment.id,
        },
        totalQuantity,
        priceLists: lists
          .filter(
            (list): list is typeof list & { activeVersion: { id: string; version: number } } =>
              Boolean(list.activeVersion) &&
              isOrderQuantityInRange(
                totalQuantity,
                list.minimumOrderQuantity,
                list.maximumOrderQuantity,
              ),
          )
          .map((list) => ({
            id: list.id,
            code: list.code,
            name: list.name,
            type: 'STANDALONE_PRODUCT' as const,
            minimumOrderQuantity: list.minimumOrderQuantity,
            maximumOrderQuantity: list.maximumOrderQuantity,
            activeVersion: list.activeVersion,
          })),
      },
    };
  }

  async savedCatalog(query: OrderSavedCatalogQuery): Promise<OrderSavedCatalogEnvelope> {
    const search = query.search.trim();
    const currentCalculation: Prisma.CalculationVersionWhereInput = {
      current: true,
      catalogVisible: true,
      ...(query.customerId ? { customers: { some: { customerId: query.customerId } } } : {}),
      series: {
        priceList: { active: true, type: 'KIT_COMPONENT' },
        ...(search
          ? {
              kit: {
                OR: [{ code: { contains: search } }, { description: { contains: search } }],
              },
            }
          : {}),
      },
    };
    const itemWhere: Prisma.CalculationItemWhereInput = {
      hasPrice: true,
      catalogVisible: true,
      calculationVersion: {
        current: true,
        ...(query.customerId ? { customers: { some: { customerId: query.customerId } } } : {}),
        series: { priceList: { active: true, type: 'KIT_COMPONENT' } },
      },
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              {
                calculationVersion: {
                  series: {
                    kit: {
                      OR: [{ code: { contains: search } }, { description: { contains: search } }],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [kitTotal, kits, itemRows] = await Promise.all([
      this.prisma.calculationVersion.count({ where: currentCalculation }),
      this.prisma.calculationVersion.findMany({
        where: currentCalculation,
        orderBy: [{ series: { kit: { code: 'asc' } } }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          version: true,
          createdAt: true,
          kitDescription: true,
          minimumTotal: true,
          normalTotal: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          catalogScope: true,
          series: {
            select: {
              kit: {
                select: {
                  code: true,
                  currentImage: {
                    select: { id: true, width: true, height: true, createdAt: true },
                  },
                },
              },
              priceList: { select: { id: true, code: true, name: true, type: true } },
            },
          },
          priceListVersion: { select: { id: true, version: true } },
        },
      }),
      this.prisma.calculationItem.findMany({
        where: itemWhere,
        orderBy: [{ productCode: 'asc' }, { calculationVersion: { createdAt: 'desc' } }],
        select: {
          id: true,
          productId: true,
          productCode: true,
          description: true,
          unit: true,
          minimumUnitPrice: true,
          normalUnitPrice: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          product: {
            select: {
              currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
            },
          },
          calculationVersion: {
            select: {
              createdAt: true,
              priceListVersion: { select: { id: true, version: true } },
              series: {
                select: {
                  kit: { select: { code: true, description: true } },
                  priceList: { select: { id: true, code: true, name: true, type: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const bySource = new Map<string, OrderCalculatedProductCatalogItem>();
    for (const item of itemRows) {
      const source = item.calculationVersion;
      const key = `${source.priceListVersion.id}:${item.productCode}`;
      const existing = bySource.get(key);
      const kit = source.series.kit;
      if (existing) {
        if (!existing.kits.some(({ code }) => code === kit.code)) existing.kits.push(kit);
        continue;
      }
      bySource.set(key, {
        kind: 'CALCULATED_PRODUCT',
        calculationItemId: item.id,
        productId: item.productId,
        code: item.productCode,
        description: item.catalogDescription ?? item.description,
        unit: item.unit,
        minimumPrice: (item.catalogMinimumPrice ?? item.minimumUnitPrice).toString(),
        normalPrice: (item.catalogNormalPrice ?? item.normalUnitPrice).toString(),
        calculatedAt: source.createdAt.toISOString(),
        priceList: { ...source.series.priceList, type: 'KIT_COMPONENT' },
        priceListVersion: source.priceListVersion,
        kits: [kit],
        image: item.product.currentImage ? imageReference(item.product.currentImage) : null,
      });
    }
    const allCalculatedProducts = [...bySource.values()];
    const start = (query.page - 1) * query.pageSize;
    return {
      data: {
        calculatedProducts: allCalculatedProducts.slice(start, start + query.pageSize),
        kits: kits.map((kit): OrderKitCatalogItem => ({
          kind: 'KIT',
          calculationId: kit.id,
          calculationVersion: kit.version,
          code: kit.series.kit.code,
          description: kit.catalogDescription ?? kit.kitDescription,
          minimumPrice: (kit.catalogMinimumPrice ?? kit.minimumTotal).toString(),
          normalPrice: (kit.catalogNormalPrice ?? kit.normalTotal).toString(),
          scope: kit.catalogScope,
          calculatedAt: kit.createdAt.toISOString(),
          priceList: kit.series.priceList,
          priceListVersion: kit.priceListVersion,
          image: kit.series.kit.currentImage ? imageReference(kit.series.kit.currentImage) : null,
        })),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        calculatedProductTotal: allCalculatedProducts.length,
        calculatedProductTotalPages: Math.max(
          1,
          Math.ceil(allCalculatedProducts.length / query.pageSize),
        ),
        kitTotal,
        kitTotalPages: Math.max(1, Math.ceil(kitTotal / query.pageSize)),
      },
    };
  }

  async savedKitComposition(calculationId: string): Promise<SavedKitCompositionEnvelope> {
    const calculation = await this.prisma.calculationVersion.findFirst({
      where: { id: calculationId, current: true, catalogVisible: true },
      select: {
        id: true,
        kitDescription: true,
        catalogDescription: true,
        series: { select: { kit: { select: { code: true } } } },
        customers: {
          orderBy: { createdAt: 'asc' },
          select: {
            customerId: true,
            customerCodeSnapshot: true,
            customerNameSnapshot: true,
            customer: { select: { code: true, legalName: true } },
          },
        },
        items: {
          orderBy: { lineNumber: 'asc' },
          select: {
            lineNumber: true,
            productCode: true,
            description: true,
            quantity: true,
            unit: true,
            minimumUnitPrice: true,
            normalUnitPrice: true,
            minimumTotal: true,
            normalTotal: true,
            hasPrice: true,
          },
        },
      },
    });
    if (!calculation) throw new AppError(404, 'SAVED_KIT_NOT_FOUND', 'Kit salvo não encontrado.');

    return {
      data: {
        kit: {
          calculationId: calculation.id,
          code: calculation.series.kit.code,
          description: calculation.catalogDescription ?? calculation.kitDescription,
          customers: calculation.customers.map((link) => ({
            id: link.customerId,
            code: link.customerCodeSnapshot ?? link.customer.code,
            legalName: link.customerNameSnapshot ?? link.customer.legalName,
          })),
          items: calculation.items.map((item) => ({
            lineNumber: item.lineNumber,
            code: item.productCode,
            description: item.description,
            quantity: item.quantity.toString(),
            unit: item.unit,
            minimumUnitPrice: item.minimumUnitPrice.toFixed(4),
            normalUnitPrice: item.normalUnitPrice.toFixed(4),
            minimumTotal: item.minimumTotal.toFixed(4),
            normalTotal: item.normalTotal.toFixed(4),
            hasPrice: item.hasPrice,
          })),
        },
      },
    };
  }

  async updateSavedCatalogItem(
    params: SavedCatalogItemParams,
    input: UpdateSavedCatalogItemCommand,
  ): Promise<SavedCatalogMutationEnvelope> {
    const prices = {
      catalogDescription: input.description,
      catalogMinimumPrice: new Prisma.Decimal(input.minimumPrice),
      catalogNormalPrice: new Prisma.Decimal(input.normalPrice),
      catalogVisible: true,
    };
    if (params.kind === 'products') {
      const existing = await this.prisma.calculationItem.findFirst({
        where: { id: params.id, hasPrice: true, calculationVersion: { current: true } },
        select: {
          productCode: true,
          calculationVersion: { select: { priceListVersionId: true } },
        },
      });
      if (!existing)
        throw new AppError(404, 'SAVED_PRODUCT_NOT_FOUND', 'Produto salvo não encontrado.');
      await this.prisma.calculationItem.updateMany({
        where: {
          productCode: existing.productCode,
          calculationVersion: {
            current: true,
            priceListVersionId: existing.calculationVersion.priceListVersionId,
          },
        },
        data: prices,
      });
    } else {
      const existing = await this.prisma.calculationVersion.findFirst({
        where: { id: params.id, current: true },
      });
      if (!existing) throw new AppError(404, 'SAVED_KIT_NOT_FOUND', 'Kit salvo não encontrado.');
      await this.prisma.calculationVersion.update({
        where: { id: params.id },
        data: { ...prices, ...(input.scope ? { catalogScope: input.scope } : {}) },
      });
    }
    return { data: { updated: true } };
  }

  async deleteSavedCatalogItem(params: SavedCatalogItemParams): Promise<void> {
    if (params.kind === 'products') {
      const existing = await this.prisma.calculationItem.findFirst({
        where: { id: params.id, hasPrice: true, calculationVersion: { current: true } },
        select: {
          productCode: true,
          calculationVersion: { select: { priceListVersionId: true } },
        },
      });
      if (!existing)
        throw new AppError(404, 'SAVED_PRODUCT_NOT_FOUND', 'Produto salvo não encontrado.');
      await this.prisma.calculationItem.updateMany({
        where: {
          productCode: existing.productCode,
          calculationVersion: {
            current: true,
            priceListVersionId: existing.calculationVersion.priceListVersionId,
          },
        },
        data: { catalogVisible: false },
      });
      return;
    }
    const result = await this.prisma.calculationVersion.updateMany({
      where: { id: params.id, current: true },
      data: { catalogVisible: false },
    });
    if (!result.count) throw new AppError(404, 'SAVED_KIT_NOT_FOUND', 'Kit salvo não encontrado.');
  }

  async catalog(query: OrderCatalogQuery): Promise<OrderCatalogEnvelope> {
    const customer = query.customerId ? await this.customer(query.customerId) : null;
    const customerSegmentId = customer?.customerSegment?.active
      ? customer.customerSegment.id
      : null;
    const customerClassId = customer?.customerClass?.active ? customer.customerClass.id : null;

    const eligibleLists =
      customer && !customerSegmentId
        ? []
        : await this.prisma.priceList.findMany({
            where: {
              type: 'STANDALONE_PRODUCT',
              active: true,
              activeVersionId: { not: null },
              ...(customer
                ? { segments: { some: { customerSegmentId: customerSegmentId! } } }
                : {}),
            },
            select: {
              id: true,
              code: true,
              name: true,
              minimumOrderQuantity: true,
              maximumOrderQuantity: true,
              activeVersion: { select: { id: true, version: true } },
            },
            orderBy: [{ name: 'asc' }, { code: 'asc' }],
          });
    const listsByVersion = new Map(
      eligibleLists
        .filter((list) => list.activeVersion)
        .map((list) => [list.activeVersion!.id, list]),
    );
    const versionIds = [...listsByVersion.keys()];
    const search = query.search.trim();
    const productWhere: Prisma.PriceListItemWhereInput = {
      priceListVersionId: { in: versionIds },
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              { reference: { contains: search } },
              { priceListVersion: { priceList: { name: { contains: search } } } },
            ],
          }
        : {}),
    };
    const kitAudience: Prisma.CalculationVersionWhereInput = customer
      ? customerClassId
        ? {
            series: {
              priceList: {
                active: true,
                type: 'KIT_COMPONENT',
                classes: { some: { customerClassId } },
              },
            },
            OR: [
              { catalogScope: 'STANDARD' },
              {
                catalogScope: 'CUSTOMER_SPECIFIC',
                customers: { some: { customerId: customer.id } },
              },
            ],
          }
        : { id: { in: [] } }
      : {
          catalogScope: 'STANDARD',
          series: { priceList: { active: true, type: 'KIT_COMPONENT' } },
        };
    const kitWhere: Prisma.CalculationVersionWhereInput = {
      current: true,
      catalogVisible: true,
      AND: [
        kitAudience,
        ...(search
          ? [
              {
                series: {
                  kit: {
                    OR: [{ code: { contains: search } }, { description: { contains: search } }],
                  },
                },
              } satisfies Prisma.CalculationVersionWhereInput,
            ]
          : []),
      ],
    };
    const [products, kitTotal, kits] = await Promise.all([
      this.prisma.priceListItem.findMany({
        where: productWhere,
        orderBy: [
          { productCode: 'asc' },
          { priceListVersion: { priceList: { name: 'asc' } } },
          { sourceRow: 'asc' },
        ],
        select: {
          productCode: true,
          description: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
          icmsRate: true,
          priceListVersionId: true,
          priceListVersion: { select: { version: true } },
        },
      }),
      this.prisma.calculationVersion.count({ where: kitWhere }),
      this.prisma.calculationVersion.findMany({
        where: kitWhere,
        orderBy: [{ series: { kit: { code: 'asc' } } }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          version: true,
          createdAt: true,
          kitDescription: true,
          minimumTotal: true,
          normalTotal: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          catalogScope: true,
          series: {
            select: {
              kit: {
                select: {
                  code: true,
                  currentImage: {
                    select: { id: true, width: true, height: true, createdAt: true },
                  },
                },
              },
              priceList: { select: { id: true, code: true, name: true, type: true } },
            },
          },
          priceListVersion: { select: { id: true, version: true } },
        },
      }),
    ]);
    const validProducts = products.filter(
      (item) => item.unitPrice && item.ipiRate && item.ipiIncluded === true,
    );
    type ValidProduct = (typeof validProducts)[number];
    const productsByCode = new Map<string, ValidProduct[]>();
    for (const item of validProducts) {
      const offers = productsByCode.get(item.productCode) ?? [];
      offers.push(item);
      productsByCode.set(item.productCode, offers);
    }
    const aggregatedProducts = [...productsByCode.values()].map((offers) => {
      const minimum = offers.reduce((lowest, offer) =>
        offer.unitPrice!.lessThan(lowest.unitPrice!) ? offer : lowest,
      );
      const maximum = offers.reduce((highest, offer) =>
        offer.unitPrice!.greaterThan(highest.unitPrice!) ? offer : highest,
      );
      return { offers, minimum, maximum };
    });
    const productTotal = aggregatedProducts.length;
    const paginatedProducts = aggregatedProducts.slice(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize,
    );
    const identities = await this.prisma.product.findMany({
      where: { code: { in: paginatedProducts.map(({ maximum }) => maximum.productCode) } },
      select: {
        id: true,
        code: true,
        currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
      },
    });
    const productIdentities = new Map(identities.map((identity) => [identity.code, identity]));
    return {
      data: {
        customer: customer
          ? { id: customer.id, code: customer.code, legalName: customer.legalName }
          : null,
        products: paginatedProducts.map(({ offers, minimum, maximum: item }) => {
          const list = listsByVersion.get(item.priceListVersionId)!;
          const price = item.unitPrice!.toString();
          return {
            kind: 'STANDALONE_PRODUCT' as const,
            productId: productIdentities.get(item.productCode)?.id ?? null,
            code: item.productCode,
            description: item.description ?? '',
            reference: item.reference ?? '',
            unitPrice: price,
            minimumPrice: minimum.unitPrice!.toString(),
            maximumPrice: price,
            priceRanges: offers.map((offer) => {
              const offerList = listsByVersion.get(offer.priceListVersionId)!;
              return {
                priceList: {
                  id: offerList.id,
                  code: offerList.code,
                  name: offerList.name,
                },
                priceListVersionId: offer.priceListVersionId,
                priceListVersion: offer.priceListVersion.version,
                minimumOrderQuantity: offerList.minimumOrderQuantity,
                maximumOrderQuantity: offerList.maximumOrderQuantity,
                minimumPrice: minimum.unitPrice!.toString(),
                maximumPrice: offer.unitPrice!.toString(),
                ipiRate: offer.ipiRate!.toString(),
                icmsRate: offer.icmsRate.toString(),
              };
            }),
            ipiRate: item.ipiRate!.toString(),
            ipiIncluded: true as const,
            icmsRate: item.icmsRate.toString(),
            priceListVersionId: item.priceListVersionId,
            priceListVersion: item.priceListVersion.version,
            priceList: { id: list.id, code: list.code, name: list.name },
            image: productIdentities.get(item.productCode)?.currentImage
              ? imageReference(productIdentities.get(item.productCode)!.currentImage!)
              : null,
          };
        }),
        kits: kits.map((kit): OrderKitCatalogItem => ({
          kind: 'KIT',
          calculationId: kit.id,
          calculationVersion: kit.version,
          code: kit.series.kit.code,
          description: kit.catalogDescription ?? kit.kitDescription,
          minimumPrice: (kit.catalogMinimumPrice ?? kit.minimumTotal).toString(),
          normalPrice: (kit.catalogNormalPrice ?? kit.normalTotal).toString(),
          scope: kit.catalogScope,
          calculatedAt: kit.createdAt.toISOString(),
          priceList: kit.series.priceList,
          priceListVersion: kit.priceListVersion,
          image: kit.series.kit.currentImage ? imageReference(kit.series.kit.currentImage) : null,
        })),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        productTotal,
        productTotalPages: Math.max(1, Math.ceil(productTotal / query.pageSize)),
        kitTotal,
        kitTotalPages: Math.max(1, Math.ceil(kitTotal / query.pageSize)),
      },
    };
  }

  /* Fluxo anterior de catálogo por uma lista manual, mantido no histórico da migração.
  private async legacyCatalog(query: any): Promise<any> {
    const customer = await this.customer(query.customerId);
    const totalQuantity = orderTotalQuantity(query.quantities.map((quantity) => ({ quantity })));
    if (!customer.customerSegment?.active) {
      throw new AppError(
        422,
        'CUSTOMER_SEGMENT_REQUIRED',
        'O cliente não possui um segmento ativo definido.',
      );
    }
    if (!customer.customerClass?.active) {
      throw new AppError(
        422,
        'CUSTOMER_CLASS_REQUIRED',
        'O cliente não possui uma classe ativa definida.',
      );
    }
    const list = await this.prisma.priceList.findFirst({
      where: {
        id: query.priceListId,
        type: 'STANDALONE_PRODUCT',
        active: true,
        segments: { some: { customerSegmentId: customer.customerSegment.id } },
      },
      select: {
        id: true,
        code: true,
        name: true,
        minimumOrderQuantity: true,
        maximumOrderQuantity: true,
        activeVersion: { select: { id: true, version: true } },
      },
    });
    if (!list?.activeVersion) {
      throw new AppError(
        404,
        'ORDER_PRICE_LIST_NOT_AVAILABLE',
        'A lista não está disponível para o cliente atual.',
      );
    }
    const activeVersion = list.activeVersion;
    if (
      !isOrderQuantityInRange(totalQuantity, list.minimumOrderQuantity, list.maximumOrderQuantity)
    ) {
      throw new AppError(
        422,
        'ORDER_PRICE_LIST_QUANTITY_NOT_ALLOWED',
        'A quantidade atual não é compatível com a lista selecionada.',
      );
    }

    const search = query.search.trim();
    const productWhere: Prisma.PriceListItemWhereInput = {
      priceListVersionId: activeVersion.id,
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              { reference: { contains: search } },
            ],
          }
        : {}),
    };
    const kitWhere: Prisma.CalculationVersionWhereInput = {
      current: true,
      catalogVisible: true,
      customers: { some: { customerId: customer.id } },
      series: {
        priceList: {
          active: true,
          type: 'KIT_COMPONENT',
          classes: { some: { customerClassId: customer.customerClass.id } },
        },
        ...(search
          ? {
              kit: {
                OR: [{ code: { contains: search } }, { description: { contains: search } }],
              },
            }
          : {}),
      },
    };
    const calculatedProductWhere: Prisma.CalculationItemWhereInput = {
      hasPrice: true,
      catalogVisible: true,
      calculationVersion: {
        current: true,
        customers: { some: { customerId: customer.id } },
        series: {
          priceList: {
            active: true,
            type: 'KIT_COMPONENT',
            classes: { some: { customerClassId: customer.customerClass.id } },
          },
        },
      },
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              {
                calculationVersion: {
                  series: {
                    kit: {
                      OR: [{ code: { contains: search } }, { description: { contains: search } }],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [productTotal, products, kitTotal, kits, calculatedProductRows] = await Promise.all([
      this.prisma.priceListItem.count({ where: productWhere }),
      this.prisma.priceListItem.findMany({
        where: productWhere,
        orderBy: [{ sourceRow: 'asc' }, { productCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          productCode: true,
          description: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
        },
      }),
      this.prisma.calculationVersion.count({ where: kitWhere }),
      this.prisma.calculationVersion.findMany({
        where: kitWhere,
        orderBy: [{ series: { kit: { code: 'asc' } } }, { createdAt: 'desc' }],
        take: 50,
        select: {
          id: true,
          version: true,
          createdAt: true,
          kitDescription: true,
          minimumTotal: true,
          normalTotal: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          series: {
            select: {
              kit: { select: { code: true } },
              priceList: { select: { id: true, code: true, name: true, type: true } },
            },
          },
          priceListVersion: { select: { id: true, version: true } },
        },
      }),
      this.prisma.calculationItem.findMany({
        where: calculatedProductWhere,
        orderBy: [{ productCode: 'asc' }, { calculationVersion: { createdAt: 'desc' } }],
        select: {
          id: true,
          productId: true,
          productCode: true,
          description: true,
          unit: true,
          minimumUnitPrice: true,
          normalUnitPrice: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          calculationVersion: {
            select: {
              createdAt: true,
              priceListVersion: { select: { id: true, version: true } },
              series: {
                select: {
                  kit: { select: { code: true, description: true } },
                  priceList: { select: { id: true, code: true, name: true, type: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const identities = await this.prisma.product.findMany({
      where: { code: { in: products.map(({ productCode }) => productCode) } },
      select: { id: true, code: true },
    });
    const productIds = new Map(identities.map(({ id, code }) => [code, id]));
    const validProducts = products.filter(
      (item) => item.unitPrice && item.ipiRate && item.ipiIncluded === true,
    );
    const calculatedProductsBySource = new Map<string, OrderCalculatedProductCatalogItem>();
    for (const item of calculatedProductRows) {
      const source = item.calculationVersion;
      const key = `${source.priceListVersion.id}:${item.productCode}`;
      const existing = calculatedProductsBySource.get(key);
      const kit = source.series.kit;
      if (existing) {
        if (!existing.kits.some(({ code }) => code === kit.code)) existing.kits.push(kit);
        continue;
      }
      calculatedProductsBySource.set(key, {
        kind: 'CALCULATED_PRODUCT',
        calculationItemId: item.id,
        productId: item.productId,
        code: item.productCode,
        description: item.catalogDescription ?? item.description,
        unit: item.unit,
        minimumPrice: (item.catalogMinimumPrice ?? item.minimumUnitPrice).toString(),
        normalPrice: (item.catalogNormalPrice ?? item.normalUnitPrice).toString(),
        calculatedAt: source.createdAt.toISOString(),
        priceList: { ...source.series.priceList, type: 'KIT_COMPONENT' },
        priceListVersion: source.priceListVersion,
        kits: [kit],
      });
    }
    const calculatedProducts = [...calculatedProductsBySource.values()];
    return {
      data: {
        customer: { id: customer.id, code: customer.code, legalName: customer.legalName },
        standalonePriceList: {
          id: list.id,
          code: list.code,
          name: list.name,
          activeVersion,
        },
        products: validProducts.map((item) => ({
          kind: 'STANDALONE_PRODUCT' as const,
          productId: productIds.get(item.productCode) ?? null,
          code: item.productCode,
          description: item.description ?? '',
          reference: item.reference ?? '',
          unitPrice: item.unitPrice!.toString(),
          ipiRate: item.ipiRate!.toString(),
          ipiIncluded: true as const,
          priceListVersionId: activeVersion.id,
          priceListVersion: activeVersion.version,
        })),
        calculatedProducts,
        kits: kits.map((kit): OrderKitCatalogItem => ({
          kind: 'KIT',
          calculationId: kit.id,
          calculationVersion: kit.version,
          code: kit.series.kit.code,
          description: kit.catalogDescription ?? kit.kitDescription,
          minimumPrice: (kit.catalogMinimumPrice ?? kit.minimumTotal).toString(),
          normalPrice: (kit.catalogNormalPrice ?? kit.normalTotal).toString(),
          calculatedAt: kit.createdAt.toISOString(),
          priceList: kit.series.priceList,
          priceListVersion: kit.priceListVersion,
        })),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        productTotal,
        productTotalPages: Math.max(1, Math.ceil(productTotal / query.pageSize)),
        calculatedProductTotal: calculatedProducts.length,
        kitTotal,
      },
    };
  }

  */

  async quote(
    command: OrderQuoteCommand,
    actor: AuthenticatedUser | null = null,
  ): Promise<OrderQuoteEnvelope> {
    const customer = await this.customer(command.customerId);
    const productLines = command.lines.filter(
      (line): line is Extract<OrderQuoteCommand['lines'][number], { kind: 'STANDALONE_PRODUCT' }> =>
        line.kind === 'STANDALONE_PRODUCT',
    );
    const kitLines = command.lines.filter(
      (line): line is Extract<OrderQuoteCommand['lines'][number], { kind: 'KIT' }> =>
        line.kind === 'KIT',
    );
    if (productLines.length && !customer.customerSegment?.active) {
      throw new AppError(
        422,
        'CUSTOMER_SEGMENT_REQUIRED',
        'O cliente não possui um segmento ativo definido para os produtos avulsos.',
      );
    }
    if (kitLines.length && !customer.customerClass?.active) {
      throw new AppError(
        422,
        'CUSTOMER_CLASS_REQUIRED',
        'O cliente não possui uma classe ativa definida para os kits.',
      );
    }

    const [products, kits, productIdentities] = await Promise.all([
      this.prisma.priceListItem.findMany({
        where: {
          OR: productLines.map((line) => ({
            priceListVersionId: line.priceListVersionId,
            productCode: line.productCode,
          })),
          priceListVersion: {
            activeForLists: {
              some: {
                active: true,
                type: 'STANDALONE_PRODUCT',
                segments: {
                  some: { customerSegmentId: customer.customerSegment?.id ?? '' },
                },
              },
            },
          },
        },
        select: {
          productCode: true,
          description: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
          icmsRate: true,
          priceListVersionId: true,
          priceListVersion: {
            select: {
              id: true,
              version: true,
              priceList: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  minimumOrderQuantity: true,
                  maximumOrderQuantity: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.calculationVersion.findMany({
        where: {
          id: { in: kitLines.map(({ calculationId }) => calculationId) },
          current: true,
          catalogVisible: true,
          series: {
            priceList: {
              active: true,
              type: 'KIT_COMPONENT',
              classes: { some: { customerClassId: customer.customerClass?.id ?? '' } },
            },
          },
          OR: [
            { catalogScope: 'STANDARD' },
            {
              catalogScope: 'CUSTOMER_SPECIFIC',
              customers: { some: { customerId: customer.id } },
            },
          ],
        },
        select: {
          id: true,
          version: true,
          kitDescription: true,
          minimumTotal: true,
          normalTotal: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          catalogScope: true,
          series: {
            select: {
              kit: {
                select: {
                  id: true,
                  code: true,
                  currentImage: {
                    select: { id: true, width: true, height: true, createdAt: true },
                  },
                },
              },
              priceList: { select: { id: true, code: true, name: true, type: true } },
            },
          },
          priceListVersion: { select: { id: true, version: true } },
        },
      }),
      this.prisma.product.findMany({
        where: { code: { in: productLines.map(({ productCode }) => productCode) } },
        select: {
          id: true,
          code: true,
          unit: true,
          currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
        },
      }),
    ]);
    const productByKey = new Map(
      products.map((product) => [`${product.priceListVersionId}:${product.productCode}`, product]),
    );
    const kitById = new Map(kits.map((kit) => [kit.id, kit]));
    const productIdentityByCode = new Map(
      productIdentities.map((product) => [product.code, product]),
    );
    const unavailable: string[] = [];
    for (const line of productLines) {
      const product = productByKey.get(`${line.priceListVersionId}:${line.productCode}`);
      if (!product?.unitPrice || !product.ipiRate || product.ipiIncluded !== true) {
        unavailable.push(`Produto ${line.productCode} ausente ou incompatível com o cliente.`);
        continue;
      }
      const list = product.priceListVersion.priceList;
      if (
        !isOrderQuantityInRange(line.quantity, list.minimumOrderQuantity, list.maximumOrderQuantity)
      ) {
        unavailable.push(
          `A quantidade do produto ${line.productCode} não pertence à faixa da lista ${list.name}.`,
        );
      }
    }
    for (const line of kitLines) {
      if (!kitById.has(line.calculationId))
        unavailable.push(`Kit ${line.calculationId} ausente, desatualizado ou incompatível.`);
    }
    if (unavailable.length) {
      throw new AppError(
        422,
        'ORDER_ITEMS_NOT_AVAILABLE',
        'Um ou mais itens do carrinho não estão disponíveis para o cliente atual.',
        { lines: unavailable },
      );
    }

    let total = new Prisma.Decimal(0);
    let referenceTotal = new Prisma.Decimal(0);
    const warnings = new Set<string>();
    const violations: OrderPriceViolation[] = [];
    const lines = command.lines.map((line): OrderQuoteLine => {
      if (line.kind === 'STANDALONE_PRODUCT') {
        const product = productByKey.get(`${line.priceListVersionId}:${line.productCode}`)!;
        const referenceUnitPrice = product.unitPrice!;
        const negotiatedUnitPrice = new Prisma.Decimal(
          line.negotiatedUnitPrice ?? referenceUnitPrice.toFixed(4),
        );
        if (
          line.negotiatedUnitPrice !== undefined &&
          !negotiatedUnitPrice.equals(referenceUnitPrice) &&
          actor &&
          !actor.permissions.includes('price.override')
        ) {
          throw new AppError(
            403,
            'ORDER_PRICE_OVERRIDE_FORBIDDEN',
            `Você não possui permissão para alterar o preço do produto ${product.productCode}.`,
          );
        }
        const subtotal = negotiatedUnitPrice.mul(line.quantity);
        total = total.add(subtotal);
        referenceTotal = referenceTotal.add(referenceUnitPrice.mul(line.quantity));
        if (!product.ipiRate!.isZero())
          warnings.add(
            'O IPI dos produtos avulsos já está incluído no preço e não foi somado novamente.',
          );
        const list = product.priceListVersion.priceList;
        return {
          kind: 'STANDALONE_PRODUCT',
          productId: productIdentityByCode.get(product.productCode)?.id ?? null,
          productCode: product.productCode,
          priceList: {
            id: list.id,
            code: list.code,
            name: list.name,
            minimumOrderQuantity: list.minimumOrderQuantity,
            maximumOrderQuantity: list.maximumOrderQuantity,
          },
          description: product.description ?? '',
          reference: product.reference ?? '',
          unit: productIdentityByCode.get(product.productCode)?.unit ?? null,
          quantity: line.quantity,
          unitPrice: negotiatedUnitPrice.toFixed(4),
          referenceUnitPrice: referenceUnitPrice.toFixed(4),
          negotiatedUnitPrice: negotiatedUnitPrice.toFixed(4),
          minimumReferencePrice: referenceUnitPrice.toFixed(4),
          normalReferencePrice: referenceUnitPrice.toFixed(4),
          subtotal: subtotal.toFixed(4),
          ipiRate: product.ipiRate!.toFixed(4),
          ipiIncluded: true,
          icmsRate: product.icmsRate.toFixed(4),
          priceListVersion: {
            id: product.priceListVersion.id,
            version: product.priceListVersion.version,
          },
          image: productIdentityByCode.get(product.productCode)?.currentImage
            ? imageReference(productIdentityByCode.get(product.productCode)!.currentImage!)
            : null,
        };
      }
      const kit = kitById.get(line.calculationId)!;
      const referenceUnitPrice =
        line.priceReference === 'MINIMUM'
          ? (kit.catalogMinimumPrice ?? kit.minimumTotal)
          : (kit.catalogNormalPrice ?? kit.normalTotal);
      const minimumReferencePrice = kit.catalogMinimumPrice ?? kit.minimumTotal;
      const normalReferencePrice = kit.catalogNormalPrice ?? kit.normalTotal;
      const negotiatedUnitPrice = new Prisma.Decimal(
        line.negotiatedUnitPrice ?? referenceUnitPrice.toFixed(4),
      );
      if (
        line.negotiatedUnitPrice !== undefined &&
        !negotiatedUnitPrice.equals(referenceUnitPrice) &&
        actor &&
        !actor.permissions.includes('price.override')
      ) {
        throw new AppError(
          403,
          'ORDER_PRICE_OVERRIDE_FORBIDDEN',
          `Você não possui permissão para alterar o preço do kit ${kit.series.kit.code}.`,
        );
      }
      const subtotal = negotiatedUnitPrice.mul(line.quantity);
      total = total.add(subtotal);
      referenceTotal = referenceTotal.add(referenceUnitPrice.mul(line.quantity));
      return {
        kind: 'KIT',
        kitId: kit.series.kit.id ?? '',
        calculationId: kit.id,
        calculationVersion: kit.version,
        code: kit.series.kit.code,
        description: kit.catalogDescription ?? kit.kitDescription,
        priceReference: line.priceReference,
        quantity: line.quantity,
        unitPrice: negotiatedUnitPrice.toFixed(4),
        referenceUnitPrice: referenceUnitPrice.toFixed(4),
        negotiatedUnitPrice: negotiatedUnitPrice.toFixed(4),
        minimumReferencePrice: minimumReferencePrice.toFixed(4),
        normalReferencePrice: normalReferencePrice.toFixed(4),
        subtotal: subtotal.toFixed(4),
        priceList: {
          ...kit.series.priceList,
          type: 'KIT_COMPONENT',
          minimumOrderQuantity: null,
          maximumOrderQuantity: null,
        },
        priceListVersion: kit.priceListVersion,
        image: kit.series.kit.currentImage ? imageReference(kit.series.kit.currentImage) : null,
      };
    });
    for (const [index, line] of lines.entries()) {
      const minimum = new Prisma.Decimal(line.minimumReferencePrice);
      const negotiated = new Prisma.Decimal(line.negotiatedUnitPrice);
      if (!negotiated.lessThan(minimum)) continue;
      const unitDifference = minimum.minus(negotiated);
      const quantity = new Prisma.Decimal(line.quantity);
      violations.push({
        line: index + 1,
        kind: line.kind,
        code: line.kind === 'KIT' ? line.code : line.productCode,
        priceListVersionId: line.priceListVersion.id,
        priceListName: line.priceList.name,
        minimumOrderQuantity: line.priceList.minimumOrderQuantity,
        maximumOrderQuantity: line.priceList.maximumOrderQuantity,
        quantity: quantity.toFixed(4),
        minimumUnitPrice: minimum.toFixed(4),
        negotiatedUnitPrice: negotiated.toFixed(4),
        unitDifference: unitDifference.toFixed(4),
        totalDifference: unitDifference.mul(quantity).toFixed(4),
        differencePercentage: unitDifference.div(minimum).mul(100).toFixed(4),
      });
    }
    const now = this.clock.now();
    const resolvedRecipients = actor ? recipients(actor.email, this.notificationRecipients) : [];
    const data: OrderQuoteEnvelope['data'] = {
      customer: {
        id: customer.id,
        code: customer.code,
        legalName: customer.legalName,
        customerClassId: customer.customerClass?.active ? customer.customerClass.id : null,
        customerSegmentId: customer.customerSegment?.active ? customer.customerSegment.id : null,
        customerClass: customer.customerClass?.active
          ? {
              id: customer.customerClass.id,
              code: customer.customerClass.code,
              name: customer.customerClass.name,
            }
          : null,
        customerSegment: customer.customerSegment?.active
          ? {
              id: customer.customerSegment.id,
              code: customer.customerSegment.code,
              name: customer.customerSegment.name,
            }
          : null,
      },
      totalQuantity: orderTotalQuantity(command.lines),
      lines,
      total: total.toFixed(4),
      referenceTotal: referenceTotal.toFixed(4),
      creator: actor
        ? { id: actor.id, name: actor.name, email: normalizedEmail(actor.email) }
        : null,
      recipients: resolvedRecipients,
      quoteToken: '',
      approval: { required: violations.length > 0, violations },
      expiresAt: new Date(now.getTime() + this.quoteTtlMilliseconds).toISOString(),
      differences: lines.flatMap((line, index) =>
        line.referenceUnitPrice === line.negotiatedUnitPrice
          ? []
          : [
              {
                line: index + 1,
                code: line.kind === 'KIT' ? line.code : line.productCode,
                referenceUnitPrice: line.referenceUnitPrice,
                negotiatedUnitPrice: line.negotiatedUnitPrice,
              },
            ],
      ),
      warnings: [...warnings],
      quotedAt: now.toISOString(),
    };
    data.quoteToken = this.signQuote({
      version: 1,
      issuedAt: now.getTime(),
      expiresAt: now.getTime() + this.quoteTtlMilliseconds,
      actorId: actor?.id ?? null,
      fingerprint: this.quoteFingerprint(data),
      nonce: randomUUID(),
    });
    return {
      data,
    };
  }

  /* Fluxo anterior de cotação por lista única.
  private async legacyQuote(command: any): Promise<any> {
    const customer = await this.customer(command.customerId);
    if (!customer.customerSegment?.active) {
      throw new AppError(
        422,
        'CUSTOMER_SEGMENT_REQUIRED',
        'O cliente não possui um segmento ativo definido.',
      );
    }
    if (!customer.customerClass?.active) {
      throw new AppError(
        422,
        'CUSTOMER_CLASS_REQUIRED',
        'O cliente não possui uma classe ativa definida.',
      );
    }

    const totalQuantity = orderTotalQuantity(command.lines);
    const list = await this.prisma.priceList.findFirst({
      where: {
        id: command.priceListId,
        type: 'STANDALONE_PRODUCT',
        active: true,
        segments: { some: { customerSegmentId: customer.customerSegment.id } },
      },
      select: {
        id: true,
        code: true,
        name: true,
        minimumOrderQuantity: true,
        maximumOrderQuantity: true,
        activeVersion: { select: { id: true, version: true } },
      },
    });
    if (!list?.activeVersion) {
      throw new AppError(
        404,
        'ORDER_PRICE_LIST_NOT_AVAILABLE',
        'A lista não está disponível para o cliente atual.',
      );
    }
    if (
      !isOrderQuantityInRange(totalQuantity, list.minimumOrderQuantity, list.maximumOrderQuantity)
    ) {
      throw new AppError(
        422,
        'ORDER_PRICE_LIST_QUANTITY_NOT_ALLOWED',
        'A quantidade total não é compatível com a lista selecionada.',
        { lines: ['Escolha manualmente uma lista adequada à nova quantidade.'] },
      );
    }

    const productLines = command.lines.filter(
      (line): line is Extract<OrderQuoteCommand['lines'][number], { kind: 'STANDALONE_PRODUCT' }> =>
        line.kind === 'STANDALONE_PRODUCT',
    );
    const kitLines = command.lines.filter(
      (line): line is Extract<OrderQuoteCommand['lines'][number], { kind: 'KIT' }> =>
        line.kind === 'KIT',
    );
    const calculatedProductLines = command.lines.filter(
      (line): line is Extract<OrderQuoteCommand['lines'][number], { kind: 'CALCULATED_PRODUCT' }> =>
        line.kind === 'CALCULATED_PRODUCT',
    );
    const [products, kits, calculatedProducts] = await Promise.all([
      this.prisma.priceListItem.findMany({
        where: {
          priceListVersionId: list.activeVersion.id,
          productCode: { in: productLines.map(({ productCode }) => productCode) },
        },
        select: {
          productCode: true,
          description: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
        },
      }),
      this.prisma.calculationVersion.findMany({
        where: {
          id: { in: kitLines.map(({ calculationId }) => calculationId) },
          current: true,
          catalogVisible: true,
          customers: { some: { customerId: customer.id } },
          series: {
            priceList: {
              active: true,
              type: 'KIT_COMPONENT',
              classes: { some: { customerClassId: customer.customerClass.id } },
            },
          },
        },
        select: {
          id: true,
          version: true,
          kitDescription: true,
          minimumTotal: true,
          normalTotal: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          series: {
            select: {
              kit: { select: { code: true } },
              priceList: { select: { id: true, code: true, name: true, type: true } },
            },
          },
          priceListVersion: { select: { id: true, version: true } },
        },
      }),
      this.prisma.calculationItem.findMany({
        where: {
          id: { in: calculatedProductLines.map(({ calculationItemId }) => calculationItemId) },
          hasPrice: true,
          catalogVisible: true,
          calculationVersion: {
            current: true,
            customers: { some: { customerId: customer.id } },
            series: {
              priceList: {
                active: true,
                type: 'KIT_COMPONENT',
                classes: { some: { customerClassId: customer.customerClass.id } },
              },
            },
          },
        },
        select: {
          id: true,
          productCode: true,
          description: true,
          unit: true,
          minimumUnitPrice: true,
          normalUnitPrice: true,
          catalogDescription: true,
          catalogMinimumPrice: true,
          catalogNormalPrice: true,
          calculationVersion: {
            select: {
              priceListVersion: { select: { id: true, version: true } },
              series: {
                select: {
                  kit: { select: { code: true, description: true } },
                  priceList: { select: { id: true, code: true, name: true, type: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const productByCode = new Map(products.map((product) => [product.productCode, product]));
    const kitById = new Map(kits.map((kit) => [kit.id, kit]));
    const calculatedProductById = new Map(calculatedProducts.map((item) => [item.id, item]));
    const unavailable: string[] = [];
    for (const line of productLines) {
      const product = productByCode.get(line.productCode);
      if (!product?.unitPrice || !product.ipiRate || product.ipiIncluded !== true)
        unavailable.push(`Produto ${line.productCode} ausente na versão ativa da lista.`);
    }
    for (const line of kitLines) {
      if (!kitById.has(line.calculationId))
        unavailable.push(`Kit ${line.calculationId} ausente, desatualizado ou incompatível.`);
    }
    for (const line of calculatedProductLines) {
      if (!calculatedProductById.has(line.calculationItemId))
        unavailable.push(
          `Item calculado ${line.calculationItemId} ausente, desatualizado ou incompatível.`,
        );
    }
    if (unavailable.length) {
      throw new AppError(
        422,
        'ORDER_ITEMS_NOT_AVAILABLE',
        'Um ou mais itens do carrinho não estão disponíveis para o cliente atual.',
        { lines: unavailable },
      );
    }

    let total = new Prisma.Decimal(0);
    const warnings = new Set<string>();
    const lines = command.lines.map((line): OrderQuoteLine => {
      if (line.kind === 'STANDALONE_PRODUCT') {
        const product = productByCode.get(line.productCode)!;
        const unitPrice = product.unitPrice!;
        const subtotal = unitPrice.mul(line.quantity);
        total = total.add(subtotal);
        if (!product.ipiRate!.isZero())
          warnings.add(
            'O IPI dos produtos avulsos já está incluído no preço e não foi somado novamente.',
          );
        return {
          kind: 'STANDALONE_PRODUCT',
          productCode: product.productCode,
          description: product.description ?? '',
          reference: product.reference ?? '',
          quantity: line.quantity,
          unitPrice: unitPrice.toFixed(4),
          subtotal: subtotal.toFixed(4),
          ipiRate: product.ipiRate!.toFixed(4),
          ipiIncluded: true,
          priceListVersion: list.activeVersion!,
        };
      }
      if (line.kind === 'CALCULATED_PRODUCT') {
        const item = calculatedProductById.get(line.calculationItemId)!;
        const unitPrice =
          line.priceReference === 'MINIMUM'
            ? (item.catalogMinimumPrice ?? item.minimumUnitPrice)
            : (item.catalogNormalPrice ?? item.normalUnitPrice);
        const subtotal = unitPrice.mul(line.quantity);
        total = total.add(subtotal);
        const source = item.calculationVersion;
        return {
          kind: 'CALCULATED_PRODUCT',
          calculationItemId: item.id,
          productCode: item.productCode,
          description: item.catalogDescription ?? item.description,
          unit: item.unit,
          priceReference: line.priceReference,
          quantity: line.quantity,
          unitPrice: unitPrice.toFixed(4),
          subtotal: subtotal.toFixed(4),
          priceList: { ...source.series.priceList, type: 'KIT_COMPONENT' },
          priceListVersion: source.priceListVersion,
          kits: [source.series.kit],
        };
      }
      const kit = kitById.get(line.calculationId)!;
      const unitPrice =
        line.priceReference === 'MINIMUM'
          ? (kit.catalogMinimumPrice ?? kit.minimumTotal)
          : (kit.catalogNormalPrice ?? kit.normalTotal);
      const subtotal = unitPrice.mul(line.quantity);
      total = total.add(subtotal);
      return {
        kind: 'KIT',
        calculationId: kit.id,
        calculationVersion: kit.version,
        code: kit.series.kit.code,
        description: kit.catalogDescription ?? kit.kitDescription,
        priceReference: line.priceReference,
        quantity: line.quantity,
        unitPrice: unitPrice.toFixed(4),
        subtotal: subtotal.toFixed(4),
        priceList: { ...kit.series.priceList, type: 'KIT_COMPONENT' },
        priceListVersion: kit.priceListVersion,
      };
    });

    return {
      data: {
        customer: {
          id: customer.id,
          code: customer.code,
          legalName: customer.legalName,
          customerClassId: customer.customerClass.id,
          customerSegmentId: customer.customerSegment.id,
        },
        standalonePriceList: {
          id: list.id,
          code: list.code,
          name: list.name,
          activeVersion: list.activeVersion,
        },
        totalQuantity,
        lines,
        total: total.toFixed(4),
        warnings: [...warnings],
        quotedAt: new Date().toISOString(),
      },
    };
  }
  */

  async create(
    command: CreateOrderCommand,
    idempotencyKey: string,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<CreateOrderEnvelope> {
    const contentHash = sha256(
      stableJson({
        customerId: command.customerId,
        lines: command.lines,
        note: command.note,
        ...(command.approvalRequestId ? { approvalRequestId: command.approvalRequestId } : {}),
      }),
    );
    const existing = await this.repository.findByIdempotency(actor.id, idempotencyKey);
    if (existing) {
      if (existing.contentHash !== contentHash) {
        throw new AppError(
          409,
          'ORDER_IDEMPOTENCY_CONFLICT',
          'Esta tentativa de confirmação já foi usada com outro conteúdo.',
        );
      }
      return { data: { ...existing.snapshot, replayed: true } };
    }

    const quote = await this.quote(command, actor);
    const quoteToken = this.verifyQuoteToken(
      command.quoteToken,
      actor.id,
      this.quoteFingerprint(quote.data),
    );
    let priceApproval: CreateOrderSnapshot['priceApproval'] = null;
    if (quote.data.approval.required) {
      if (!command.approvalRequestId) {
        throw new AppError(
          422,
          'ORDER_PRICE_APPROVAL_REQUIRED',
          'O carrinho possui preços abaixo do mínimo e exige aprovação.',
        );
      }
      const approval = await this.prisma.orderPriceApprovalRequest.findFirst({
        where: {
          id: command.approvalRequestId,
          requestedByUserId: actor.id,
          customerId: command.customerId,
        },
        select: {
          id: true,
          status: true,
          contentHash: true,
          hashVersion: true,
          version: true,
          reviewedAt: true,
          approvedUntil: true,
          consumedOrderId: true,
        },
      });
      if (!approval) {
        throw new AppError(404, 'ORDER_PRICE_APPROVAL_NOT_FOUND', 'Solicitação não encontrada.');
      }
      if (approval.status === 'CONSUMED' || approval.consumedOrderId) {
        throw new AppError(
          409,
          'ORDER_PRICE_APPROVAL_ALREADY_CONSUMED',
          'Esta aprovação já foi utilizada em outro pedido.',
        );
      }
      const now = this.clock.now();
      if (approval.status === 'EXPIRED') {
        throw new AppError(
          409,
          'ORDER_PRICE_APPROVAL_EXPIRED',
          'A aprovação expirou. Solicite uma nova aprovação.',
        );
      }
      if (approval.status !== 'APPROVED' || !approval.reviewedAt || !approval.approvedUntil) {
        throw new AppError(
          409,
          'ORDER_PRICE_APPROVAL_NOT_APPROVED',
          'A solicitação ainda não possui uma aprovação válida.',
        );
      }
      if (approval.approvedUntil.getTime() <= now.getTime()) {
        throw new AppError(
          409,
          'ORDER_PRICE_APPROVAL_EXPIRED',
          'A aprovação expirou. Solicite uma nova aprovação.',
        );
      }
      if (quoteToken.issuedAt < approval.reviewedAt.getTime()) {
        throw new AppError(
          409,
          'ORDER_QUOTE_STALE',
          'A aprovação exige uma nova revisão do pedido.',
        );
      }
      const resolved = approvalContentFromQuote(quote.data, actor.id);
      const hashed = hashOrderPriceApprovalContent(resolved.content);
      if (hashed.version !== approval.hashVersion || hashed.hash !== approval.contentHash) {
        throw new AppError(
          409,
          'ORDER_PRICE_APPROVAL_CONTENT_MISMATCH',
          'O carrinho mudou depois da aprovação. Solicite uma nova aprovação.',
        );
      }
      priceApproval = {
        id: approval.id,
        expectedVersion: approval.version,
        contentHash: approval.contentHash,
        hashVersion: approval.hashVersion,
      };
    } else if (command.approvalRequestId) {
      throw new AppError(
        422,
        'ORDER_PRICE_APPROVAL_NOT_REQUIRED',
        'O carrinho não possui preço abaixo do mínimo e não deve consumir uma aprovação.',
      );
    }
    const customer = await this.customer(command.customerId);
    const snapshot: CreateOrderSnapshot = {
      idempotencyKey,
      contentHash,
      customer: {
        id: customer.id,
        code: customer.code,
        legalName: customer.legalName,
        taxId: customer.cnpj,
        city: customer.city,
        state: customer.state,
        customerClass: customer.customerClass?.active
          ? {
              id: customer.customerClass.id,
              code: customer.customerClass.code,
              name: customer.customerClass.name,
            }
          : null,
        customerSegment: customer.customerSegment?.active
          ? {
              id: customer.customerSegment.id,
              code: customer.customerSegment.code,
              name: customer.customerSegment.name,
            }
          : null,
      },
      creator: { id: actor.id, name: actor.name, email: normalizedEmail(actor.email) },
      note: command.note || null,
      totalQuantity: String(quote.data.totalQuantity),
      totalAmount: quote.data.total,
      items: quote.data.lines.map((line) => ({
        kind: line.kind,
        sourceProductId: line.kind === 'STANDALONE_PRODUCT' ? line.productId : null,
        sourceKitId: line.kind === 'KIT' ? line.kitId : null,
        sourceCalculationVersionId: line.kind === 'KIT' ? line.calculationId : null,
        sourcePriceListVersionId: line.priceListVersion.id,
        priceList: {
          id: line.priceList.id,
          code: line.priceList.code,
          name: line.priceList.name,
          type: line.kind === 'KIT' ? line.priceList.type : 'STANDALONE_PRODUCT',
          version: line.priceListVersion.version,
        },
        calculationVersion: line.kind === 'KIT' ? line.calculationVersion : null,
        priceReference: line.kind === 'KIT' ? line.priceReference : 'UNIT',
        code: line.kind === 'KIT' ? line.code : line.productCode,
        description: line.description,
        reference: line.kind === 'STANDALONE_PRODUCT' ? line.reference : null,
        unit: null,
        quantity: String(line.quantity),
        referenceUnitPrice: line.referenceUnitPrice,
        negotiatedUnitPrice: line.negotiatedUnitPrice,
        minimumReferencePrice: line.minimumReferencePrice,
        normalReferencePrice: line.normalReferencePrice,
        ipiRate: line.kind === 'STANDALONE_PRODUCT' ? line.ipiRate : null,
        icmsRate: line.kind === 'STANDALONE_PRODUCT' ? line.icmsRate : null,
        subtotal: line.subtotal,
      })),
      delivery: {
        recipients: quote.data.recipients,
        fromAddress: this.emailFrom,
        fromName: this.emailFromName,
        replyTo: this.emailReplyTo,
        templateVersion: 'order-v1',
        idempotencyKey: `order-email:${sha256(idempotencyKey)}`,
        contentHash,
      },
      priceApproval,
    };

    try {
      const created = await this.repository.createWithFirstDelivery(snapshot, { requestId });
      return { data: { ...created, replayed: false } };
    } catch (error) {
      if (error instanceof OrderPriceApprovalConsumptionConflictError) {
        const concurrent = await this.repository.findByIdempotency(actor.id, idempotencyKey);
        if (concurrent?.contentHash === contentHash) {
          return { data: { ...concurrent.snapshot, replayed: true } };
        }
        throw new AppError(
          409,
          error.code,
          'Esta aprovação já foi utilizada ou deixou de estar disponível.',
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.repository.findByIdempotency(actor.id, idempotencyKey);
        if (concurrent?.contentHash === contentHash) {
          return { data: { ...concurrent.snapshot, replayed: true } };
        }
        throw new AppError(
          409,
          'ORDER_IDEMPOTENCY_CONFLICT',
          'Esta tentativa de confirmação já foi usada com outro conteúdo.',
        );
      }
      throw error;
    }
  }

  async details(id: string, actor: AuthenticatedUser): Promise<OrderDetailsEnvelope> {
    const details = await this.repository.findDetails(id);
    if (
      !details ||
      (details.order.creator.id !== actor.id && actor.roleCode !== ROLE_CODES.administrator)
    ) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Pedido nÃ£o encontrado.');
    }
    return { data: details };
  }
}
