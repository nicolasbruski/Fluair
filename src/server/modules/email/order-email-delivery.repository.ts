import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import type { OrderEmailRenderInput } from './order-email-renderer.js';

export interface ReservedOrderEmailDelivery {
  id: string;
  orderId: string;
  reservationToken: string;
  attemptCount: number;
  recipients: string[];
  fromAddress: string;
  fromName: string | null;
  replyTo: string | null;
  templateVersion: string;
  idempotencyKey: string;
  order: OrderEmailRenderInput;
}

export interface DeliveryFailure {
  kind: 'TRANSIENT' | 'PERMANENT';
  code: string;
  publicMessage: string;
  nextAttemptAt: Date | null;
}

export interface OrderEmailDeliveryRepository {
  reserveNext(now: Date, reservationDurationMs: number): Promise<ReservedOrderEmailDelivery | null>;
  markAccepted(
    delivery: ReservedOrderEmailDelivery,
    provider: string,
    messageId: string,
    now: Date,
  ): Promise<boolean>;
  markFailure(
    delivery: ReservedOrderEmailDelivery,
    failure: DeliveryFailure,
    now: Date,
  ): Promise<boolean>;
}

function recipients(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export class PrismaOrderEmailDeliveryRepository implements OrderEmailDeliveryRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenGenerator: () => string = randomUUID,
  ) {}

  async reserveNext(
    now: Date,
    reservationDurationMs: number,
  ): Promise<ReservedOrderEmailDelivery | null> {
    return this.prisma.$transaction(async (transaction) => {
      const candidate = await transaction.orderEmailDelivery.findFirst({
        where: {
          OR: [
            { status: 'PENDING', nextAttemptAt: { lte: now } },
            { status: 'PROCESSING', reservationExpiresAt: { lte: now } },
          ],
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
      });
      if (!candidate) return null;
      const reservationToken = this.tokenGenerator();
      const reserved = await transaction.orderEmailDelivery.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: 'PENDING', nextAttemptAt: { lte: now } },
            { status: 'PROCESSING', reservationExpiresAt: { lte: now } },
          ],
        },
        data: {
          status: 'PROCESSING',
          reservationToken,
          processingStartedAt: now,
          reservationExpiresAt: new Date(now.getTime() + reservationDurationMs),
          attemptCount: { increment: 1 },
          publicError: null,
          technicalErrorCode: null,
        },
      });
      if (reserved.count !== 1) return null;
      const delivery = await transaction.orderEmailDelivery.findUniqueOrThrow({
        where: { id: candidate.id },
        include: { order: { include: { items: { orderBy: { lineNumber: 'asc' } } } } },
      });
      return {
        id: delivery.id,
        orderId: delivery.orderId,
        reservationToken,
        attemptCount: delivery.attemptCount,
        recipients: recipients(delivery.toRecipients),
        fromAddress: delivery.fromAddress,
        fromName: delivery.fromName,
        replyTo: delivery.replyTo,
        templateVersion: delivery.templateVersion,
        idempotencyKey: delivery.idempotencyKey,
        order: {
          number: delivery.order.number,
          submittedAt: delivery.order.submittedAt,
          customer: {
            code: delivery.order.customerCodeSnapshot,
            name: delivery.order.customerNameSnapshot,
            city: delivery.order.customerCitySnapshot,
            state: delivery.order.customerStateSnapshot,
          },
          creator: {
            name: delivery.order.createdByNameSnapshot,
            email: delivery.order.createdByEmailSnapshot,
          },
          note: delivery.order.note,
          totalQuantity: delivery.order.totalQuantity.toFixed(4),
          totalAmount: delivery.order.totalAmount.toFixed(4),
          items: delivery.order.items.map((item) => ({
            code: item.codeSnapshot,
            description: item.descriptionSnapshot,
            reference: item.referenceSnapshot,
            quantity: item.quantity.toFixed(4),
            unit: item.unitSnapshot,
            negotiatedUnitPrice: item.negotiatedUnitPrice.toFixed(4),
            subtotal: item.subtotal.toFixed(4),
          })),
        },
      };
    });
  }

  async markAccepted(
    delivery: ReservedOrderEmailDelivery,
    provider: string,
    messageId: string,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.orderEmailDelivery.updateMany({
        where: {
          id: delivery.id,
          status: 'PROCESSING',
          reservationToken: delivery.reservationToken,
        },
        data: {
          status: 'ACCEPTED',
          provider,
          providerMessageId: messageId,
          acceptedAt: now,
          reservationToken: null,
          reservationExpiresAt: null,
          publicError: null,
          technicalErrorCode: null,
        },
      });
      if (updated.count !== 1) return false;
      await transaction.auditLog.create({
        data: {
          action: 'ORDER_EMAIL_ACCEPTED',
          entityType: 'order_email_delivery',
          entityId: delivery.id,
          requestId: `email-worker:${delivery.id}:${delivery.attemptCount}`,
          metadata: { orderId: delivery.orderId, provider, attemptCount: delivery.attemptCount },
        },
      });
      return true;
    });
  }

  async markFailure(
    delivery: ReservedOrderEmailDelivery,
    failure: DeliveryFailure,
    now: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const terminal = failure.nextAttemptAt === null;
      const updated = await transaction.orderEmailDelivery.updateMany({
        where: {
          id: delivery.id,
          status: 'PROCESSING',
          reservationToken: delivery.reservationToken,
        },
        data: {
          status: terminal ? 'FAILED' : 'PENDING',
          nextAttemptAt: failure.nextAttemptAt ?? now,
          failedAt: terminal ? now : null,
          reservationToken: null,
          reservationExpiresAt: null,
          publicError: failure.publicMessage,
          technicalErrorCode: failure.code.slice(0, 80),
        },
      });
      if (updated.count !== 1) return false;
      if (terminal) {
        await transaction.auditLog.create({
          data: {
            action: 'ORDER_EMAIL_FAILED',
            entityType: 'order_email_delivery',
            entityId: delivery.id,
            requestId: `email-worker:${delivery.id}:${delivery.attemptCount}`,
            metadata: {
              orderId: delivery.orderId,
              failureKind: failure.kind,
              errorCode: failure.code.slice(0, 80),
              attemptCount: delivery.attemptCount,
            },
          },
        });
      }
      return true;
    });
  }
}
