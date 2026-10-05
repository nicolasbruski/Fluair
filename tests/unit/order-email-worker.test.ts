import pino from 'pino';
import { describe, expect, it } from 'vitest';

import {
  EmailProviderError,
  InMemoryEmailProvider,
} from '../../src/server/modules/email/email-provider.js';
import type {
  DeliveryFailure,
  OrderEmailDeliveryRepository,
  ReservedOrderEmailDelivery,
} from '../../src/server/modules/email/order-email-delivery.repository.js';
import { OrderEmailRenderer } from '../../src/server/modules/email/order-email-renderer.js';
import { OrderEmailWorker } from '../../src/server/modules/email/order-email-worker.js';

function delivery(attemptCount = 1): ReservedOrderEmailDelivery {
  return {
    id: 'delivery-1',
    orderId: 'order-1',
    reservationToken: 'reservation-1',
    attemptCount,
    recipients: ['usuario@example.com', 'operacao@example.com'],
    fromAddress: 'pedidos@example.com',
    fromName: 'Fluair',
    replyTo: null,
    templateVersion: 'order-v1',
    idempotencyKey: 'order-email/delivery-1',
    order: {
      number: 'PED-2026-000001',
      submittedAt: new Date('2026-09-29T18:00:00.000Z'),
      customer: { code: 'CLI-1', name: 'Cliente', city: null, state: null },
      creator: { name: 'Usuario', email: 'usuario@example.com' },
      note: null,
      totalQuantity: '1.0000',
      totalAmount: '10.0000',
      items: [
        {
          code: 'P-1',
          description: 'Produto',
          reference: null,
          quantity: '1.0000',
          unit: 'UN',
          negotiatedUnitPrice: '10.0000',
          subtotal: '10.0000',
        },
      ],
    },
  };
}

class FakeRepository implements OrderEmailDeliveryRepository {
  available: ReservedOrderEmailDelivery | null;
  accepted: { provider: string; messageId: string } | null = null;
  failure: DeliveryFailure | null = null;

  constructor(value: ReservedOrderEmailDelivery) {
    this.available = value;
  }

  async reserveNext(): Promise<ReservedOrderEmailDelivery | null> {
    const value = this.available;
    this.available = null;
    return value;
  }

  async markAccepted(
    _delivery: ReservedOrderEmailDelivery,
    provider: string,
    messageId: string,
  ): Promise<boolean> {
    this.accepted = { provider, messageId };
    return true;
  }

  async markFailure(
    _delivery: ReservedOrderEmailDelivery,
    failure: DeliveryFailure,
  ): Promise<boolean> {
    this.failure = failure;
    return true;
  }
}

const logger = pino({ level: 'silent' });
const clock = { now: () => new Date('2026-09-29T18:00:00.000Z') };

describe('OrderEmailWorker', () => {
  it('reserva uma unica vez sob concorrencia e aceita com a chave estavel', async () => {
    const repository = new FakeRepository(delivery());
    const provider = new InMemoryEmailProvider();
    const worker = new OrderEmailWorker(repository, provider, new OrderEmailRenderer(), logger, {
      clock,
    });

    await Promise.all([worker.processOnce(), worker.processOnce()]);

    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]?.idempotencyKey).toBe('order-email/delivery-1');
    expect(repository.accepted).toEqual({ provider: 'memory', messageId: 'memory-1' });
  });

  it('reagenda erro transitorio com backoff e sem encerrar a entrega', async () => {
    const repository = new FakeRepository(delivery(2));
    const provider = new InMemoryEmailProvider();
    provider.failure = new EmailProviderError('TRANSIENT', 'rate_limit', 'aguarde');
    const worker = new OrderEmailWorker(repository, provider, new OrderEmailRenderer(), logger, {
      clock,
      random: () => 0.5,
    });

    await worker.processOnce();

    expect(repository.failure).toMatchObject({ kind: 'TRANSIENT', code: 'rate_limit' });
    expect(repository.failure?.nextAttemptAt?.toISOString()).toBe('2026-09-29T18:05:00.000Z');
  });

  it('encerra imediatamente erro permanente e limita erros transitorios a cinco tentativas', async () => {
    for (const [attempt, error] of [
      [1, new EmailProviderError('PERMANENT', 'invalid_recipient', 'invalido')],
      [5, new EmailProviderError('TRANSIENT', 'timeout', 'timeout')],
    ] as const) {
      const repository = new FakeRepository(delivery(attempt));
      const provider = new InMemoryEmailProvider();
      provider.failure = error;
      const worker = new OrderEmailWorker(repository, provider, new OrderEmailRenderer(), logger, {
        clock,
      });
      await worker.processOnce();
      expect(repository.failure?.nextAttemptAt).toBeNull();
    }
  });
});
