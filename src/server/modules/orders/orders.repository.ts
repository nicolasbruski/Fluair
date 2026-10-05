import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  CreatedOrderSnapshot,
  CreateOrderSnapshot,
  OrderDetailsEnvelope,
  OrderItemSnapshot,
} from '../../../shared/orders.js';
import { PrismaOrderNumberGenerator, type OrderNumberGenerator } from './order-number.js';

export interface OrderCreationContext {
  requestId: string;
}

export interface OrdersRepository {
  createWithFirstDelivery(
    input: CreateOrderSnapshot,
    context: OrderCreationContext,
  ): Promise<CreatedOrderSnapshot>;
  findByIdempotency(
    creatorId: string,
    idempotencyKey: string,
  ): Promise<{ contentHash: string; snapshot: CreatedOrderSnapshot } | null>;
  findDetails(id: string): Promise<OrderDetailsEnvelope['data'] | null>;
}

export interface OrdersRepositoryDependencies {
  clock: { now(): Date };
  idGenerator: () => string;
  numberGenerator: OrderNumberGenerator;
}

export class OrderPriceApprovalConsumptionConflictError extends Error {
  readonly code = 'ORDER_PRICE_APPROVAL_ALREADY_CONSUMED';

  constructor() {
    super('A aprovação não está mais disponível para consumo.');
    this.name = 'OrderPriceApprovalConsumptionConflictError';
  }
}

const defaultDependencies: OrdersRepositoryDependencies = {
  clock: { now: () => new Date() },
  idGenerator: randomUUID,
  numberGenerator: new PrismaOrderNumberGenerator(),
};

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export class PrismaOrdersRepository implements OrdersRepository {
  private readonly dependencies: OrdersRepositoryDependencies;

  constructor(
    private readonly prisma: PrismaClient,
    dependencies: Partial<OrdersRepositoryDependencies> = {},
  ) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  async createWithFirstDelivery(
    input: CreateOrderSnapshot,
    context: OrderCreationContext,
  ): Promise<CreatedOrderSnapshot> {
    const now = this.dependencies.clock.now();
    return this.prisma.$transaction(async (transaction) => {
      const orderId = this.dependencies.idGenerator();
      const deliveryId = this.dependencies.idGenerator();
      if (input.priceApproval) {
        const reserved = await transaction.orderPriceApprovalRequest.updateMany({
          where: {
            id: input.priceApproval.id,
            status: 'APPROVED',
            version: input.priceApproval.expectedVersion,
            requestedByUserId: input.creator.id,
            customerId: input.customer.id,
            contentHash: input.priceApproval.contentHash,
            hashVersion: input.priceApproval.hashVersion,
            approvedUntil: { gt: now },
            consumedOrderId: null,
          },
          data: {
            status: 'CONSUMED',
            consumedAt: now,
            version: { increment: 1 },
            updatedAt: now,
          },
        });
        if (reserved.count !== 1) throw new OrderPriceApprovalConsumptionConflictError();
      }

      const number = await this.dependencies.numberGenerator.next(transaction, now);

      await transaction.order.create({
        data: {
          id: orderId,
          number,
          status: 'SUBMITTED',
          customerId: input.customer.id,
          customerCodeSnapshot: input.customer.code,
          customerNameSnapshot: input.customer.legalName,
          customerTaxIdSnapshot: input.customer.taxId,
          customerCitySnapshot: input.customer.city,
          customerStateSnapshot: input.customer.state,
          customerClassIdSnapshot: input.customer.customerClass?.id ?? null,
          customerClassCodeSnapshot: input.customer.customerClass?.code ?? null,
          customerClassNameSnapshot: input.customer.customerClass?.name ?? null,
          customerSegmentIdSnapshot: input.customer.customerSegment?.id ?? null,
          customerSegmentCodeSnapshot: input.customer.customerSegment?.code ?? null,
          customerSegmentNameSnapshot: input.customer.customerSegment?.name ?? null,
          createdByUserId: input.creator.id,
          createdByNameSnapshot: input.creator.name,
          createdByEmailSnapshot: input.creator.email,
          note: input.note,
          totalQuantity: decimal(input.totalQuantity),
          totalAmount: decimal(input.totalAmount),
          idempotencyKey: input.idempotencyKey,
          contentHash: input.contentHash,
          submittedAt: now,
          items: {
            createMany: {
              data: input.items.map((item, index) => ({
                id: this.dependencies.idGenerator(),
                lineNumber: index + 1,
                kind: item.kind,
                sourceProductId: item.sourceProductId,
                sourceKitId: item.sourceKitId,
                sourceCalculationVersionId: item.sourceCalculationVersionId,
                sourcePriceListVersionId: item.sourcePriceListVersionId,
                sourcePriceListIdSnapshot: item.priceList.id,
                sourcePriceListCodeSnapshot: item.priceList.code,
                sourcePriceListNameSnapshot: item.priceList.name,
                sourcePriceListTypeSnapshot: item.priceList.type,
                sourcePriceListVersionSnapshot: item.priceList.version,
                sourceCalculationVersionSnapshot: item.calculationVersion,
                priceReferenceSnapshot: item.priceReference,
                codeSnapshot: item.code,
                descriptionSnapshot: item.description,
                referenceSnapshot: item.reference,
                unitSnapshot: item.unit,
                quantity: decimal(item.quantity),
                referenceUnitPrice: decimal(item.referenceUnitPrice),
                negotiatedUnitPrice: decimal(item.negotiatedUnitPrice),
                minimumReferencePrice:
                  item.minimumReferencePrice === null ? null : decimal(item.minimumReferencePrice),
                normalReferencePrice:
                  item.normalReferencePrice === null ? null : decimal(item.normalReferencePrice),
                ipiRate: item.ipiRate === null ? null : decimal(item.ipiRate),
                icmsRate: item.icmsRate === null ? null : decimal(item.icmsRate),
                subtotal: decimal(item.subtotal),
              })),
            },
          },
        },
      });

      await transaction.orderEmailDelivery.create({
        data: {
          id: deliveryId,
          orderId,
          status: 'PENDING',
          toRecipients: input.delivery.recipients,
          fromAddress: input.delivery.fromAddress,
          fromName: input.delivery.fromName,
          replyTo: input.delivery.replyTo,
          templateVersion: input.delivery.templateVersion,
          idempotencyKey: input.delivery.idempotencyKey,
          contentHash: input.delivery.contentHash,
          nextAttemptAt: now,
        },
      });

      if (input.priceApproval) {
        const linked = await transaction.orderPriceApprovalRequest.updateMany({
          where: {
            id: input.priceApproval.id,
            status: 'CONSUMED',
            version: input.priceApproval.expectedVersion + 1,
            consumedAt: now,
            consumedOrderId: null,
          },
          data: { consumedOrderId: orderId },
        });
        if (linked.count !== 1) throw new OrderPriceApprovalConsumptionConflictError();
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: input.creator.id,
          action: 'ORDER_SUBMITTED',
          entityType: 'order',
          entityId: orderId,
          metadata: {
            number,
            deliveryId,
            itemCount: input.items.length,
            hasNegotiatedPrices: input.items.some(
              (item) => item.negotiatedUnitPrice !== item.referenceUnitPrice,
            ),
            approvalRequestId: input.priceApproval?.id ?? null,
          },
          requestId: context.requestId,
        },
      });

      if (input.priceApproval) {
        await transaction.auditLog.create({
          data: {
            actorUserId: input.creator.id,
            action: 'ORDER_PRICE_APPROVAL_CONSUMED',
            entityType: 'order_price_approval_request',
            entityId: input.priceApproval.id,
            metadata: {
              requesterId: input.creator.id,
              customerId: input.customer.id,
              previousStatus: 'APPROVED',
              status: 'CONSUMED',
              contentHash: input.priceApproval.contentHash,
              hashVersion: input.priceApproval.hashVersion,
              orderId,
              orderNumber: number,
              itemCount: input.items.length,
            },
            requestId: context.requestId,
            createdAt: now,
          },
        });
      }

      await transaction.orderDraft.deleteMany({
        where: {
          userId: input.creator.id,
          customerId: input.customer.id,
        },
      });

      return {
        order: { id: orderId, number, status: 'SUBMITTED', submittedAt: now.toISOString() },
        emailDelivery: {
          id: deliveryId,
          status: 'PENDING',
          recipients: [...input.delivery.recipients],
        },
      };
    });
  }

  async findByIdempotency(
    creatorId: string,
    idempotencyKey: string,
  ): Promise<{ contentHash: string; snapshot: CreatedOrderSnapshot } | null> {
    const order = await this.prisma.order.findUnique({
      where: {
        createdByUserId_idempotencyKey: { createdByUserId: creatorId, idempotencyKey },
      },
      select: {
        id: true,
        number: true,
        status: true,
        submittedAt: true,
        contentHash: true,
        emailDeliveries: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, status: true, toRecipients: true },
        },
      },
    });
    const delivery = order?.emailDeliveries[0];
    if (!order || order.status !== 'SUBMITTED' || !delivery) {
      return null;
    }
    const recipients = Array.isArray(delivery.toRecipients)
      ? delivery.toRecipients.filter((item): item is string => typeof item === 'string')
      : [];
    return {
      contentHash: order.contentHash,
      snapshot: {
        order: {
          id: order.id,
          number: order.number,
          status: 'SUBMITTED',
          submittedAt: order.submittedAt.toISOString(),
        },
        emailDelivery: { id: delivery.id, status: delivery.status, recipients },
      },
    };
  }

  async findDetails(id: string): Promise<OrderDetailsEnvelope['data'] | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { orderBy: { lineNumber: 'asc' } },
        emailDeliveries: { orderBy: { createdAt: 'asc' } },
        priceApprovalRequest: {
          select: {
            id: true,
            status: true,
            requestedAt: true,
            reviewedAt: true,
            approvedUntil: true,
            consumedAt: true,
            reviewedByUserId: true,
            reviewedByNameSnapshot: true,
            reviewNote: true,
          },
        },
      },
    });
    if (!order) return null;

    return {
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        submittedAt: order.submittedAt.toISOString(),
        customer: {
          id: order.customerId,
          code: order.customerCodeSnapshot,
          legalName: order.customerNameSnapshot,
          taxId: order.customerTaxIdSnapshot,
          city: order.customerCitySnapshot,
          state: order.customerStateSnapshot,
          customerClass: order.customerClassIdSnapshot
            ? {
                id: order.customerClassIdSnapshot,
                code: order.customerClassCodeSnapshot ?? '',
                name: order.customerClassNameSnapshot ?? '',
              }
            : null,
          customerSegment: order.customerSegmentIdSnapshot
            ? {
                id: order.customerSegmentIdSnapshot,
                code: order.customerSegmentCodeSnapshot ?? '',
                name: order.customerSegmentNameSnapshot ?? '',
              }
            : null,
        },
        creator: {
          id: order.createdByUserId,
          name: order.createdByNameSnapshot,
          email: order.createdByEmailSnapshot,
        },
        note: order.note,
        totalQuantity: order.totalQuantity.toFixed(4),
        totalAmount: order.totalAmount.toFixed(4),
        items: order.items.map((item) => ({
          kind: item.kind,
          sourceProductId: item.sourceProductId,
          sourceKitId: item.sourceKitId,
          sourceCalculationVersionId: item.sourceCalculationVersionId,
          sourcePriceListVersionId: item.sourcePriceListVersionId,
          priceList: {
            id: item.sourcePriceListIdSnapshot,
            code: item.sourcePriceListCodeSnapshot,
            name: item.sourcePriceListNameSnapshot,
            type: item.sourcePriceListTypeSnapshot as OrderItemSnapshot['priceList']['type'],
            version: item.sourcePriceListVersionSnapshot,
          },
          calculationVersion: item.sourceCalculationVersionSnapshot,
          priceReference: item.priceReferenceSnapshot as OrderItemSnapshot['priceReference'],
          code: item.codeSnapshot,
          description: item.descriptionSnapshot,
          reference: item.referenceSnapshot,
          unit: item.unitSnapshot,
          quantity: item.quantity.toFixed(4),
          referenceUnitPrice: item.referenceUnitPrice.toFixed(4),
          negotiatedUnitPrice: item.negotiatedUnitPrice.toFixed(4),
          minimumReferencePrice: item.minimumReferencePrice?.toFixed(4) ?? null,
          normalReferencePrice: item.normalReferencePrice?.toFixed(4) ?? null,
          ipiRate: item.ipiRate?.toFixed(4) ?? null,
          icmsRate: item.icmsRate?.toFixed(4) ?? null,
          subtotal: item.subtotal.toFixed(4),
        })),
      },
      emailDeliveries: order.emailDeliveries.map((delivery) => ({
        id: delivery.id,
        status: delivery.status,
        recipients: stringArray(delivery.toRecipients),
        attemptCount: delivery.attemptCount,
        publicError: delivery.publicError,
        acceptedAt: delivery.acceptedAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        failedAt: delivery.failedAt?.toISOString() ?? null,
        bouncedAt: delivery.bouncedAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
      })),
      priceApproval:
        order.priceApprovalRequest?.status === 'CONSUMED' &&
        order.priceApprovalRequest.reviewedAt &&
        order.priceApprovalRequest.approvedUntil &&
        order.priceApprovalRequest.consumedAt &&
        order.priceApprovalRequest.reviewedByUserId &&
        order.priceApprovalRequest.reviewedByNameSnapshot
          ? {
              id: order.priceApprovalRequest.id,
              status: 'CONSUMED',
              requestedAt: order.priceApprovalRequest.requestedAt.toISOString(),
              reviewedAt: order.priceApprovalRequest.reviewedAt.toISOString(),
              approvedUntil: order.priceApprovalRequest.approvedUntil.toISOString(),
              consumedAt: order.priceApprovalRequest.consumedAt.toISOString(),
              reviewer: {
                id: order.priceApprovalRequest.reviewedByUserId,
                name: order.priceApprovalRequest.reviewedByNameSnapshot,
              },
              decisionNote: order.priceApprovalRequest.reviewNote,
            }
          : null,
    };
  }
}
