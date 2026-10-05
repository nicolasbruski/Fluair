import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  CreateOrderPriceApprovalSnapshot,
  OrderPriceApprovalConditionalUpdate,
  OrderPriceApprovalCreateResult,
  OrderPriceApprovalDetail,
  OrderPriceApprovalItemSnapshot,
  OrderPriceApprovalListEnvelope,
  OrderPriceApprovalStatusCode,
  MyOrderPriceApprovalSummary,
  AdminOrderPriceApprovalSummary,
} from '../../../shared/order-price-approvals.js';
import { orderPriceApprovalSummary } from '../../../shared/order-price-approvals.js';

export class OrderPriceApprovalIdempotencyConflictError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_IDEMPOTENCY_CONFLICT';

  constructor() {
    super('A chave de idempotência já foi usada com outro conteúdo.');
    this.name = 'OrderPriceApprovalIdempotencyConflictError';
  }
}

export class OrderPriceApprovalSnapshotError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_INVALID_SNAPSHOT';

  constructor(message: string) {
    super(message);
    this.name = 'OrderPriceApprovalSnapshotError';
  }
}

export class OrderPriceApprovalSupersedeConflictError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_SUPERSEDE_CONFLICT';

  constructor() {
    super('A solicitação anterior não está mais pendente ou não pertence ao solicitante.');
    this.name = 'OrderPriceApprovalSupersedeConflictError';
  }
}

export interface OrderPriceApprovalRepositoryContext {
  requestId: string;
}

export interface OrderPriceApprovalsRepository {
  create(
    input: CreateOrderPriceApprovalSnapshot,
    context: OrderPriceApprovalRepositoryContext,
  ): Promise<OrderPriceApprovalCreateResult>;
  findById(id: string): Promise<OrderPriceApprovalDetail | null>;
  findOwnedById(id: string, requesterId: string): Promise<OrderPriceApprovalDetail | null>;
  findByIdempotency(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<OrderPriceApprovalDetail | null>;
  listOwned(input: {
    requesterId: string;
    status?: OrderPriceApprovalStatusCode;
    page: number;
    pageSize: number;
  }): Promise<OrderPriceApprovalListEnvelope<MyOrderPriceApprovalSummary>>;
  countPending(): Promise<number>;
  listAdmin(input: {
    status?: OrderPriceApprovalStatusCode;
    requestedFrom?: Date;
    requestedTo?: Date;
    requesterId?: string;
    customerId?: string;
    code?: string;
    page: number;
    pageSize: number;
    now: Date;
  }): Promise<OrderPriceApprovalListEnvelope<AdminOrderPriceApprovalSummary>>;
  decide(input: {
    id: string;
    expectedVersion: number;
    status: 'APPROVED' | 'REJECTED';
    reviewer: { id: string; name: string; email: string };
    reviewNote: string | null;
    reviewedAt: Date;
    approvedUntil: Date | null;
    requestId: string;
  }): Promise<boolean>;
  expireApproved(input: {
    now: Date;
    requestId: string;
    id?: string;
    requesterId?: string;
  }): Promise<number>;
  cancelOwned(input: {
    id: string;
    requesterId: string;
    expectedVersion: number;
    requestId: string;
  }): Promise<boolean>;
  conditionalUpdate(input: OrderPriceApprovalConditionalUpdate): Promise<boolean>;
}

export interface OrderPriceApprovalRepositoryDependencies {
  clock: { now(): Date };
  idGenerator: () => string;
}

const defaultDependencies: OrderPriceApprovalRepositoryDependencies = {
  clock: { now: () => new Date() },
  idGenerator: randomUUID,
};

type ApprovalRow = Prisma.OrderPriceApprovalRequestGetPayload<{
  include: {
    items: true;
    consumedOrder: { select: { id: true; number: true } };
  };
}>;

const detailInclude = {
  items: { orderBy: { lineNumber: 'asc' as const } },
  consumedOrder: { select: { id: true, number: true } },
};

function decimal(value: string, field: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite() || parsed.isNegative()) throw new Error('invalid');
    return parsed;
  } catch {
    throw new OrderPriceApprovalSnapshotError(`${field} deve ser decimal não negativo.`);
  }
}

function itemFromRow(item: ApprovalRow['items'][number]): OrderPriceApprovalItemSnapshot {
  return {
    lineNumber: item.lineNumber,
    kind: item.kind,
    requiresApproval: item.requiresApproval,
    sourceProductId: item.sourceProductId,
    sourceKitId: item.sourceKitId,
    sourceCalculationVersionId: item.sourceCalculationVersionId,
    sourcePriceListVersionId: item.sourcePriceListVersionId,
    priceList: {
      id: item.sourcePriceListId,
      code: item.sourcePriceListCodeSnapshot,
      name: item.sourcePriceListNameSnapshot,
      type: item.sourcePriceListTypeSnapshot as OrderPriceApprovalItemSnapshot['priceList']['type'],
      version: item.sourcePriceListVersionSnapshot,
      minimumOrderQuantity: item.minimumOrderQuantitySnapshot,
      maximumOrderQuantity: item.maximumOrderQuantitySnapshot,
    },
    calculationVersion: item.sourceCalculationVersionSnapshot,
    priceReference: item.priceReferenceSnapshot as OrderPriceApprovalItemSnapshot['priceReference'],
    code: item.codeSnapshot,
    description: item.descriptionSnapshot,
    reference: item.referenceSnapshot,
    unit: item.unitSnapshot,
    quantity: item.quantity.toFixed(4),
    referenceUnitPrice: item.referenceUnitPrice.toFixed(4),
    minimumUnitPrice: item.minimumUnitPrice.toFixed(4),
    negotiatedUnitPrice: item.negotiatedUnitPrice.toFixed(4),
    minimumSubtotal: item.minimumSubtotal.toFixed(4),
    negotiatedSubtotal: item.negotiatedSubtotal.toFixed(4),
    exceptionUnitAmount: item.exceptionUnitAmount.toFixed(4),
    exceptionTotalAmount: item.exceptionTotalAmount.toFixed(4),
    ipiRate: item.ipiRate?.toFixed(4) ?? null,
    icmsRate: item.icmsRate?.toFixed(4) ?? null,
  };
}

function detailFromRow(row: ApprovalRow): OrderPriceApprovalDetail {
  const reviewer =
    row.reviewedByUserId && row.reviewedByNameSnapshot && row.reviewedByEmailSnapshot
      ? {
          id: row.reviewedByUserId,
          name: row.reviewedByNameSnapshot,
          email: row.reviewedByEmailSnapshot,
        }
      : null;
  return {
    id: row.id,
    status: row.status,
    requester: {
      id: row.requestedByUserId,
      name: row.requestedByNameSnapshot,
      email: row.requestedByEmailSnapshot,
    },
    customer: {
      id: row.customerId,
      code: row.customerCodeSnapshot,
      legalName: row.customerNameSnapshot,
      customerClass: row.customerClassIdSnapshot
        ? {
            id: row.customerClassIdSnapshot,
            code: row.customerClassCodeSnapshot ?? '',
            name: row.customerClassNameSnapshot ?? '',
          }
        : null,
      customerSegment: row.customerSegmentIdSnapshot
        ? {
            id: row.customerSegmentIdSnapshot,
            code: row.customerSegmentCodeSnapshot ?? '',
            name: row.customerSegmentNameSnapshot ?? '',
          }
        : null,
    },
    justification: row.justification,
    requestedAt: row.requestedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    totalQuantity: row.totalQuantity.toFixed(4),
    minimumTotalAmount: row.minimumTotalAmount.toFixed(4),
    requestedTotalAmount: row.requestedTotalAmount.toFixed(4),
    exceptionAmount: row.exceptionAmount.toFixed(4),
    itemCount: row.items.length,
    exceptionCount: row.items.filter((item) => item.requiresApproval).length,
    decision:
      reviewer && row.reviewedAt
        ? {
            reviewer,
            note: row.reviewNote,
            reviewedAt: row.reviewedAt.toISOString(),
            approvedUntil: row.approvedUntil?.toISOString() ?? null,
          }
        : null,
    consumedOrder: row.consumedOrder,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    version: row.version,
    items: row.items.map(itemFromRow),
  };
}

function pendingDetail(
  id: string,
  input: CreateOrderPriceApprovalSnapshot,
  now: Date,
): OrderPriceApprovalDetail {
  return {
    id,
    status: 'PENDING',
    requester: input.requester,
    customer: input.customer,
    justification: input.justification,
    requestedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    totalQuantity: decimal(input.totalQuantity, 'totalQuantity').toFixed(4),
    minimumTotalAmount: decimal(input.minimumTotalAmount, 'minimumTotalAmount').toFixed(4),
    requestedTotalAmount: decimal(input.requestedTotalAmount, 'requestedTotalAmount').toFixed(4),
    exceptionAmount: decimal(input.exceptionAmount, 'exceptionAmount').toFixed(4),
    itemCount: input.items.length,
    exceptionCount: input.items.filter((item) => item.requiresApproval).length,
    decision: null,
    consumedOrder: null,
    consumedAt: null,
    version: 1,
    items: structuredClone(input.items),
  };
}

export class PrismaOrderPriceApprovalsRepository implements OrderPriceApprovalsRepository {
  private readonly dependencies: OrderPriceApprovalRepositoryDependencies;

  constructor(
    private readonly prisma: PrismaClient,
    dependencies: Partial<OrderPriceApprovalRepositoryDependencies> = {},
  ) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  async create(
    input: CreateOrderPriceApprovalSnapshot,
    context: OrderPriceApprovalRepositoryContext,
  ): Promise<OrderPriceApprovalCreateResult> {
    if (input.items.length === 0 || !input.items.some((item) => item.requiresApproval)) {
      throw new OrderPriceApprovalSnapshotError(
        'A solicitação deve possuir ao menos uma linha que exija aprovação.',
      );
    }
    const lines = input.items.map((item) => item.lineNumber);
    if (
      lines.some((line) => !Number.isInteger(line) || line <= 0) ||
      new Set(lines).size !== lines.length
    ) {
      throw new OrderPriceApprovalSnapshotError(
        'Os números das linhas devem ser positivos e únicos.',
      );
    }

    const previous = await this.prisma.orderPriceApprovalRequest.findUnique({
      where: {
        requestedByUserId_idempotencyKey: {
          requestedByUserId: input.requester.id,
          idempotencyKey: input.idempotencyKey,
        },
      },
      select: { contentHash: true },
    });
    if (previous) {
      if (previous.contentHash !== input.contentHash) {
        throw new OrderPriceApprovalIdempotencyConflictError();
      }
      const approval = await this.findByIdempotency(input.requester.id, input.idempotencyKey);
      if (!approval)
        throw new OrderPriceApprovalSnapshotError('Solicitação idempotente inconsistente.');
      return { approval, replayed: true };
    }

    const now = this.dependencies.clock.now();
    const id = this.dependencies.idGenerator();
    try {
      await this.prisma.$transaction(async (transaction) => {
        if (input.supersedesRequestId) {
          const superseded = await transaction.orderPriceApprovalRequest.updateMany({
            where: {
              id: input.supersedesRequestId,
              requestedByUserId: input.requester.id,
              status: 'PENDING',
            },
            data: { status: 'SUPERSEDED', version: { increment: 1 }, updatedAt: now },
          });
          if (superseded.count !== 1) {
            throw new OrderPriceApprovalSupersedeConflictError();
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: input.requester.id,
              action: 'ORDER_PRICE_APPROVAL_SUPERSEDED',
              entityType: 'order_price_approval_request',
              entityId: input.supersedesRequestId,
              metadata: {
                requesterId: input.requester.id,
                previousStatus: 'PENDING',
                status: 'SUPERSEDED',
                replacedByRequestId: id,
              },
              requestId: context.requestId,
              createdAt: now,
            },
          });
        }
        await transaction.orderPriceApprovalRequest.create({
          data: {
            id,
            status: 'PENDING',
            requestedByUserId: input.requester.id,
            requestedByNameSnapshot: input.requester.name,
            requestedByEmailSnapshot: input.requester.email,
            customerId: input.customer.id,
            customerCodeSnapshot: input.customer.code,
            customerNameSnapshot: input.customer.legalName,
            customerClassIdSnapshot: input.customer.customerClass?.id ?? null,
            customerClassCodeSnapshot: input.customer.customerClass?.code ?? null,
            customerClassNameSnapshot: input.customer.customerClass?.name ?? null,
            customerSegmentIdSnapshot: input.customer.customerSegment?.id ?? null,
            customerSegmentCodeSnapshot: input.customer.customerSegment?.code ?? null,
            customerSegmentNameSnapshot: input.customer.customerSegment?.name ?? null,
            justification: input.justification,
            contentHash: input.contentHash,
            hashVersion: input.hashVersion,
            totalQuantity: decimal(input.totalQuantity, 'totalQuantity'),
            minimumTotalAmount: decimal(input.minimumTotalAmount, 'minimumTotalAmount'),
            requestedTotalAmount: decimal(input.requestedTotalAmount, 'requestedTotalAmount'),
            exceptionAmount: decimal(input.exceptionAmount, 'exceptionAmount'),
            idempotencyKey: input.idempotencyKey,
            requestedAt: now,
            version: 1,
            createdAt: now,
            updatedAt: now,
            items: {
              createMany: {
                data: input.items.map((item) => ({
                  id: this.dependencies.idGenerator(),
                  lineNumber: item.lineNumber,
                  kind: item.kind,
                  requiresApproval: item.requiresApproval,
                  sourceProductId: item.sourceProductId,
                  sourceKitId: item.sourceKitId,
                  sourceCalculationVersionId: item.sourceCalculationVersionId,
                  sourcePriceListId: item.priceList.id,
                  sourcePriceListVersionId: item.sourcePriceListVersionId,
                  sourcePriceListCodeSnapshot: item.priceList.code,
                  sourcePriceListNameSnapshot: item.priceList.name,
                  sourcePriceListTypeSnapshot: item.priceList.type,
                  sourcePriceListVersionSnapshot: item.priceList.version,
                  sourceCalculationVersionSnapshot: item.calculationVersion,
                  minimumOrderQuantitySnapshot: item.priceList.minimumOrderQuantity,
                  maximumOrderQuantitySnapshot: item.priceList.maximumOrderQuantity,
                  priceReferenceSnapshot: item.priceReference,
                  codeSnapshot: item.code,
                  descriptionSnapshot: item.description,
                  referenceSnapshot: item.reference,
                  unitSnapshot: item.unit,
                  quantity: decimal(item.quantity, 'quantity'),
                  referenceUnitPrice: decimal(item.referenceUnitPrice, 'referenceUnitPrice'),
                  minimumUnitPrice: decimal(item.minimumUnitPrice, 'minimumUnitPrice'),
                  negotiatedUnitPrice: decimal(item.negotiatedUnitPrice, 'negotiatedUnitPrice'),
                  minimumSubtotal: decimal(item.minimumSubtotal, 'minimumSubtotal'),
                  negotiatedSubtotal: decimal(item.negotiatedSubtotal, 'negotiatedSubtotal'),
                  exceptionUnitAmount: decimal(item.exceptionUnitAmount, 'exceptionUnitAmount'),
                  exceptionTotalAmount: decimal(item.exceptionTotalAmount, 'exceptionTotalAmount'),
                  ipiRate: item.ipiRate === null ? null : decimal(item.ipiRate, 'ipiRate'),
                  icmsRate: item.icmsRate === null ? null : decimal(item.icmsRate, 'icmsRate'),
                  createdAt: now,
                })),
              },
            },
          },
        });

        await transaction.auditLog.create({
          data: {
            actorUserId: input.requester.id,
            action: 'ORDER_PRICE_APPROVAL_REQUESTED',
            entityType: 'order_price_approval_request',
            entityId: id,
            metadata: {
              requesterId: input.requester.id,
              customerId: input.customer.id,
              previousStatus: null,
              status: 'PENDING',
              contentHash: input.contentHash,
              hashVersion: input.hashVersion,
              itemCount: input.items.length,
              exceptionCount: input.items.filter((item) => item.requiresApproval).length,
              exceptionAmount: decimal(input.exceptionAmount, 'exceptionAmount').toFixed(4),
            },
            requestId: context.requestId,
            createdAt: now,
          },
        });
      });
      return { approval: pendingDetail(id, input, now), replayed: false };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const existing = await this.findByIdempotency(input.requester.id, input.idempotencyKey);
      if (!existing) throw error;
      const row = await this.prisma.orderPriceApprovalRequest.findUnique({
        where: {
          requestedByUserId_idempotencyKey: {
            requestedByUserId: input.requester.id,
            idempotencyKey: input.idempotencyKey,
          },
        },
        select: { contentHash: true },
      });
      if (row?.contentHash !== input.contentHash) {
        throw new OrderPriceApprovalIdempotencyConflictError();
      }
      return { approval: existing, replayed: true };
    }
  }

  async findById(id: string): Promise<OrderPriceApprovalDetail | null> {
    const row = await this.prisma.orderPriceApprovalRequest.findUnique({
      where: { id },
      include: detailInclude,
    });
    return row ? detailFromRow(row) : null;
  }

  async findOwnedById(id: string, requesterId: string): Promise<OrderPriceApprovalDetail | null> {
    const row = await this.prisma.orderPriceApprovalRequest.findFirst({
      where: { id, requestedByUserId: requesterId },
      include: detailInclude,
    });
    return row ? detailFromRow(row) : null;
  }

  async findByIdempotency(
    requesterId: string,
    idempotencyKey: string,
  ): Promise<OrderPriceApprovalDetail | null> {
    const row = await this.prisma.orderPriceApprovalRequest.findUnique({
      where: {
        requestedByUserId_idempotencyKey: { requestedByUserId: requesterId, idempotencyKey },
      },
      include: detailInclude,
    });
    return row ? detailFromRow(row) : null;
  }

  async listOwned(input: {
    requesterId: string;
    status?: OrderPriceApprovalStatusCode;
    page: number;
    pageSize: number;
  }): Promise<OrderPriceApprovalListEnvelope<MyOrderPriceApprovalSummary>> {
    const where = {
      requestedByUserId: input.requesterId,
      ...(input.status ? { status: input.status } : {}),
    } satisfies Prisma.OrderPriceApprovalRequestWhereInput;
    const [total, rows] = await Promise.all([
      this.prisma.orderPriceApprovalRequest.count({ where }),
      this.prisma.orderPriceApprovalRequest.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: detailInclude,
      }),
    ]);
    return {
      data: rows.map((row) => orderPriceApprovalSummary(detailFromRow(row))),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }

  async countPending(): Promise<number> {
    return this.prisma.orderPriceApprovalRequest.count({ where: { status: 'PENDING' } });
  }

  async listAdmin(input: {
    status?: OrderPriceApprovalStatusCode;
    requestedFrom?: Date;
    requestedTo?: Date;
    requesterId?: string;
    customerId?: string;
    code?: string;
    page: number;
    pageSize: number;
    now: Date;
  }): Promise<OrderPriceApprovalListEnvelope<AdminOrderPriceApprovalSummary>> {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.requesterId ? { requestedByUserId: input.requesterId } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.requestedFrom || input.requestedTo
        ? {
            requestedAt: {
              ...(input.requestedFrom ? { gte: input.requestedFrom } : {}),
              ...(input.requestedTo ? { lte: input.requestedTo } : {}),
            },
          }
        : {}),
      ...(input.code
        ? {
            items: {
              some: { codeSnapshot: { contains: input.code } },
            },
          }
        : {}),
    } satisfies Prisma.OrderPriceApprovalRequestWhereInput;
    const orderBy: Prisma.OrderPriceApprovalRequestOrderByWithRelationInput[] =
      input.status === 'PENDING'
        ? [{ requestedAt: 'asc' }, { id: 'asc' }]
        : [{ updatedAt: 'desc' }, { id: 'desc' }];
    const [total, rows] = await Promise.all([
      this.prisma.orderPriceApprovalRequest.count({ where }),
      this.prisma.orderPriceApprovalRequest.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: detailInclude,
      }),
    ]);
    return {
      data: rows.map((row) => {
        const detail = detailFromRow(row);
        const waitingUntil = detail.status === 'PENDING' ? input.now : new Date(detail.updatedAt);
        return {
          ...orderPriceApprovalSummary(detail),
          waitingSeconds: Math.max(
            0,
            Math.floor((waitingUntil.getTime() - new Date(detail.requestedAt).getTime()) / 1_000),
          ),
        };
      }),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize),
      },
    };
  }

  async decide(input: {
    id: string;
    expectedVersion: number;
    status: 'APPROVED' | 'REJECTED';
    reviewer: { id: string; name: string; email: string };
    reviewNote: string | null;
    reviewedAt: Date;
    approvedUntil: Date | null;
    requestId: string;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.orderPriceApprovalRequest.findUnique({
        where: { id: input.id },
        select: {
          requestedByUserId: true,
          customerId: true,
          contentHash: true,
          hashVersion: true,
          exceptionAmount: true,
          items: { select: { requiresApproval: true } },
        },
      });
      if (!current) return false;
      const changed = await transaction.orderPriceApprovalRequest.updateMany({
        where: {
          id: input.id,
          status: 'PENDING',
          version: input.expectedVersion,
        },
        data: {
          status: input.status,
          reviewedByUserId: input.reviewer.id,
          reviewedByNameSnapshot: input.reviewer.name,
          reviewedByEmailSnapshot: input.reviewer.email,
          reviewNote: input.reviewNote,
          reviewedAt: input.reviewedAt,
          approvedUntil: input.approvedUntil,
          version: { increment: 1 },
          updatedAt: input.reviewedAt,
        },
      });
      if (changed.count !== 1) return false;
      await transaction.auditLog.create({
        data: {
          actorUserId: input.reviewer.id,
          action:
            input.status === 'APPROVED'
              ? 'ORDER_PRICE_APPROVAL_APPROVED'
              : 'ORDER_PRICE_APPROVAL_REJECTED',
          entityType: 'order_price_approval_request',
          entityId: input.id,
          metadata: {
            requesterId: current.requestedByUserId,
            reviewerId: input.reviewer.id,
            customerId: current.customerId,
            previousStatus: 'PENDING',
            status: input.status,
            contentHash: current.contentHash,
            hashVersion: current.hashVersion,
            itemCount: current.items.length,
            exceptionCount: current.items.filter((item) => item.requiresApproval).length,
            exceptionAmount: current.exceptionAmount.toFixed(4),
            approvedUntil: input.approvedUntil?.toISOString() ?? null,
            expectedVersion: input.expectedVersion,
          },
          requestId: input.requestId,
          createdAt: input.reviewedAt,
        },
      });
      return true;
    });
  }

  async expireApproved(input: {
    now: Date;
    requestId: string;
    id?: string;
    requesterId?: string;
  }): Promise<number> {
    const candidates = await this.prisma.orderPriceApprovalRequest.findMany({
      where: {
        ...(input.id ? { id: input.id } : {}),
        ...(input.requesterId ? { requestedByUserId: input.requesterId } : {}),
        status: 'APPROVED',
        approvedUntil: { lte: input.now },
      },
      select: {
        id: true,
        version: true,
        requestedByUserId: true,
        reviewedByUserId: true,
        customerId: true,
        contentHash: true,
        hashVersion: true,
        exceptionAmount: true,
        items: { select: { requiresApproval: true } },
      },
      orderBy: [{ approvedUntil: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    let expired = 0;
    for (const candidate of candidates) {
      const changed = await this.prisma.$transaction(async (transaction) => {
        const update = await transaction.orderPriceApprovalRequest.updateMany({
          where: { id: candidate.id, status: 'APPROVED', version: candidate.version },
          data: { status: 'EXPIRED', version: { increment: 1 }, updatedAt: input.now },
        });
        if (update.count !== 1) return false;
        await transaction.auditLog.create({
          data: {
            actorUserId: null,
            action: 'ORDER_PRICE_APPROVAL_EXPIRED',
            entityType: 'order_price_approval_request',
            entityId: candidate.id,
            metadata: {
              requesterId: candidate.requestedByUserId,
              reviewerId: candidate.reviewedByUserId,
              customerId: candidate.customerId,
              previousStatus: 'APPROVED',
              status: 'EXPIRED',
              contentHash: candidate.contentHash,
              hashVersion: candidate.hashVersion,
              itemCount: candidate.items.length,
              exceptionCount: candidate.items.filter((item) => item.requiresApproval).length,
              exceptionAmount: candidate.exceptionAmount.toFixed(4),
            },
            requestId: input.requestId,
            createdAt: input.now,
          },
        });
        return true;
      });
      if (changed) expired += 1;
    }
    return expired;
  }

  async cancelOwned(input: {
    id: string;
    requesterId: string;
    expectedVersion: number;
    requestId: string;
  }): Promise<boolean> {
    const now = this.dependencies.clock.now();
    return this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.orderPriceApprovalRequest.updateMany({
        where: {
          id: input.id,
          requestedByUserId: input.requesterId,
          status: 'PENDING',
          version: input.expectedVersion,
        },
        data: { status: 'CANCELLED', version: { increment: 1 }, updatedAt: now },
      });
      if (changed.count !== 1) return false;
      await transaction.auditLog.create({
        data: {
          actorUserId: input.requesterId,
          action: 'ORDER_PRICE_APPROVAL_CANCELLED',
          entityType: 'order_price_approval_request',
          entityId: input.id,
          metadata: {
            requesterId: input.requesterId,
            previousStatus: 'PENDING',
            status: 'CANCELLED',
            expectedVersion: input.expectedVersion,
          },
          requestId: input.requestId,
          createdAt: now,
        },
      });
      return true;
    });
  }

  async conditionalUpdate(input: OrderPriceApprovalConditionalUpdate): Promise<boolean> {
    const result = await this.prisma.orderPriceApprovalRequest.updateMany({
      where: { id: input.id, status: input.expectedStatus, version: input.expectedVersion },
      data: {
        status: input.status,
        version: { increment: 1 },
        ...(input.reviewer
          ? {
              reviewedByUserId: input.reviewer.id,
              reviewedByNameSnapshot: input.reviewer.name,
              reviewedByEmailSnapshot: input.reviewer.email,
            }
          : {}),
        ...(input.reviewNote !== undefined ? { reviewNote: input.reviewNote } : {}),
        ...(input.reviewedAt ? { reviewedAt: new Date(input.reviewedAt) } : {}),
        ...(input.approvedUntil !== undefined
          ? { approvedUntil: input.approvedUntil ? new Date(input.approvedUntil) : null }
          : {}),
        ...(input.consumedOrderId ? { consumedOrderId: input.consumedOrderId } : {}),
        ...(input.consumedAt ? { consumedAt: new Date(input.consumedAt) } : {}),
      },
    });
    return result.count === 1;
  }
}
