import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaOrderEmailDeliveryRepository } from '../../src/server/modules/email/order-email-delivery.repository.js';

function decimal(value: string) {
  return { toFixed: () => value };
}

function fakePrisma(initialStatus: 'PENDING' | 'PROCESSING', expired = false) {
  const now = new Date('2026-09-29T18:00:00.000Z');
  const state = {
    status: initialStatus,
    reservationToken: initialStatus === 'PROCESSING' ? 'old-token' : null,
    reservationExpiresAt:
      initialStatus === 'PROCESSING' ? new Date(now.getTime() + (expired ? -1 : 60_000)) : null,
    attemptCount: 0,
  };
  const auditCreate = vi.fn();
  const orderEmailDelivery = {
    findFirst: vi.fn(async () => {
      const processable =
        state.status === 'PENDING' ||
        (state.status === 'PROCESSING' &&
          state.reservationExpiresAt !== null &&
          state.reservationExpiresAt <= now);
      return processable ? { id: 'delivery-1' } : null;
    }),
    updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const processable =
        state.status === 'PENDING' ||
        (state.status === 'PROCESSING' &&
          state.reservationExpiresAt !== null &&
          state.reservationExpiresAt <= now);
      if (!processable) return { count: 0 };
      state.status = data.status as 'PENDING' | 'PROCESSING';
      state.reservationToken = data.reservationToken as string;
      state.reservationExpiresAt = data.reservationExpiresAt as Date;
      state.attemptCount += 1;
      return { count: 1 };
    }),
    findUniqueOrThrow: vi.fn(async () => ({
      id: 'delivery-1',
      orderId: 'order-1',
      toRecipients: ['usuario@example.com', 'usuario@example.com'],
      fromAddress: 'pedidos@example.com',
      fromName: 'Fluair',
      replyTo: null,
      templateVersion: 'order-v1',
      idempotencyKey: 'order-email/delivery-1',
      attemptCount: state.attemptCount,
      order: {
        number: 'PED-2026-000001',
        submittedAt: now,
        customerCodeSnapshot: 'CLI-1',
        customerNameSnapshot: 'Cliente',
        customerCitySnapshot: null,
        customerStateSnapshot: null,
        createdByNameSnapshot: 'Usuario',
        createdByEmailSnapshot: 'usuario@example.com',
        note: null,
        totalQuantity: decimal('1.0000'),
        totalAmount: decimal('10.0000'),
        items: [
          {
            codeSnapshot: 'P-1',
            descriptionSnapshot: 'Produto',
            referenceSnapshot: null,
            quantity: decimal('1.0000'),
            unitSnapshot: 'UN',
            negotiatedUnitPrice: decimal('10.0000'),
            subtotal: decimal('10.0000'),
          },
        ],
      },
    })),
  };
  const transaction = { orderEmailDelivery, auditLog: { create: auditCreate } };
  const prisma = {
    $transaction: async (callback: (client: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  } as unknown as PrismaClient;
  return { prisma, state, now };
}

describe('PrismaOrderEmailDeliveryRepository', () => {
  it('permite apenas uma reserva concorrente para a mesma entrega', async () => {
    const fake = fakePrisma('PENDING');
    let token = 0;
    const repository = new PrismaOrderEmailDeliveryRepository(
      fake.prisma,
      () => `token-${++token}`,
    );

    const results = await Promise.all([
      repository.reserveNext(fake.now, 300_000),
      repository.reserveNext(fake.now, 300_000),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(fake.state.status).toBe('PROCESSING');
    expect(fake.state.attemptCount).toBe(1);
  });

  it('recupera uma reserva expirada depois de reinicio', async () => {
    const fake = fakePrisma('PROCESSING', true);
    const repository = new PrismaOrderEmailDeliveryRepository(fake.prisma, () => 'new-token');

    const reserved = await repository.reserveNext(fake.now, 300_000);

    expect(reserved?.reservationToken).toBe('new-token');
    expect(fake.state.reservationToken).toBe('new-token');
  });

  it('nao toma uma reserva ainda valida', async () => {
    const fake = fakePrisma('PROCESSING', false);
    const repository = new PrismaOrderEmailDeliveryRepository(fake.prisma);
    await expect(repository.reserveNext(fake.now, 300_000)).resolves.toBeNull();
  });
});
