import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  EligibleOrderPriceListsEnvelope,
  OrderCatalogEnvelope,
  OrderCalculatedProductCatalogItem,
  OrderKitCatalogItem,
  OrderQuoteEnvelope,
  OrderQuoteLine,
  SavedCatalogMutationEnvelope,
  SavedKitCompositionEnvelope,
  OrderSavedCatalogEnvelope,
} from '../../../shared/orders.js';
import { isOrderQuantityInRange, orderTotalQuantity } from '../../../shared/order-quantity.js';
import { imageReference } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';
import type {
  EligibleOrderPriceListsQuery,
  OrderCatalogQuery,
  OrderQuoteCommand,
  OrderSavedCatalogQuery,
  SavedCatalogItemParams,
  UpdateSavedCatalogItemCommand,
} from './orders.schemas.js';

type OrderCustomer = {
  id: string;
  code: string;
  legalName: string;
  customerClass: { id: string; active: boolean } | null;
  customerSegment: { id: string; active: boolean } | null;
};

export class OrdersService {
  constructor(private readonly prisma: PrismaClient) {}

  private async customer(customerId: string): Promise<OrderCustomer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, active: true },
      select: {
        id: true,
        code: true,
        legalName: true,
        customerClass: { select: { id: true, active: true } },
        customerSegment: { select: { id: true, active: true } },
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

  async quote(command: OrderQuoteCommand): Promise<OrderQuoteEnvelope> {
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
          code: true,
          currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
        },
      }),
    ]);
    const productByKey = new Map(
      products.map((product) => [`${product.priceListVersionId}:${product.productCode}`, product]),
    );
    const kitById = new Map(kits.map((kit) => [kit.id, kit]));
    const productImageByCode = new Map(
      productIdentities.map((product) => [product.code, product.currentImage]),
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
    const warnings = new Set<string>();
    const lines = command.lines.map((line): OrderQuoteLine => {
      if (line.kind === 'STANDALONE_PRODUCT') {
        const product = productByKey.get(`${line.priceListVersionId}:${line.productCode}`)!;
        const unitPrice = product.unitPrice!;
        const subtotal = unitPrice.mul(line.quantity);
        total = total.add(subtotal);
        if (!product.ipiRate!.isZero())
          warnings.add(
            'O IPI dos produtos avulsos já está incluído no preço e não foi somado novamente.',
          );
        const list = product.priceListVersion.priceList;
        return {
          kind: 'STANDALONE_PRODUCT',
          productCode: product.productCode,
          priceList: { id: list.id, code: list.code, name: list.name },
          description: product.description ?? '',
          reference: product.reference ?? '',
          quantity: line.quantity,
          unitPrice: unitPrice.toFixed(4),
          subtotal: subtotal.toFixed(4),
          ipiRate: product.ipiRate!.toFixed(4),
          ipiIncluded: true,
          icmsRate: product.icmsRate.toFixed(4),
          priceListVersion: {
            id: product.priceListVersion.id,
            version: product.priceListVersion.version,
          },
          image: productImageByCode.get(product.productCode)
            ? imageReference(productImageByCode.get(product.productCode)!)
            : null,
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
        image: kit.series.kit.currentImage ? imageReference(kit.series.kit.currentImage) : null,
      };
    });
    return {
      data: {
        customer: {
          id: customer.id,
          code: customer.code,
          legalName: customer.legalName,
          customerClassId: customer.customerClass?.active ? customer.customerClass.id : null,
          customerSegmentId: customer.customerSegment?.active ? customer.customerSegment.id : null,
        },
        totalQuantity: orderTotalQuantity(command.lines),
        lines,
        total: total.toFixed(4),
        warnings: [...warnings],
        quotedAt: new Date().toISOString(),
      },
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
}
