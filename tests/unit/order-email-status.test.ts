import { describe, expect, it } from 'vitest';

import type { OrderDetailsEnvelope } from '../../src/shared/orders.js';
import { emailDeliveryNotification } from '../../src/web/order-email-status.js';

type Delivery = OrderDetailsEnvelope['data']['emailDeliveries'][number];

function delivery(status: Delivery['status'], publicError: string | null = null): Delivery {
  return {
    id: 'delivery-1',
    status,
    recipients: ['pedidos@fluair.test'],
    attemptCount: 1,
    publicError,
    acceptedAt: null,
    deliveredAt: null,
    failedAt: null,
    bouncedAt: null,
    createdAt: '2026-10-02T12:00:00.000Z',
  };
}

describe('notificação do envio de pedido', () => {
  it('não anuncia estado intermediário como sucesso ou erro', () => {
    expect(emailDeliveryNotification('PED-2026-000001', delivery('PENDING'))).toBeNull();
    expect(emailDeliveryNotification('PED-2026-000001', delivery('PROCESSING'))).toBeNull();
  });

  it('distingue aceitação pelo provedor de entrega final', () => {
    expect(emailDeliveryNotification('PED-2026-000001', delivery('ACCEPTED'))).toEqual({
      kind: 'success',
      message: 'E-mail do pedido PED-2026-000001 aceito pelo provedor.',
    });
    expect(emailDeliveryNotification('PED-2026-000001', delivery('DELIVERED'))).toEqual({
      kind: 'success',
      message: 'E-mail do pedido PED-2026-000001 entregue.',
    });
  });

  it('usa o erro público na falha definitiva', () => {
    expect(
      emailDeliveryNotification(
        'PED-2026-000001',
        delivery('FAILED', 'O provedor recusou o endereço informado.'),
      ),
    ).toEqual({
      kind: 'error',
      message: 'E-mail do pedido PED-2026-000001: O provedor recusou o endereço informado.',
    });
  });

  it('explica a rejeição pelo destinatário', () => {
    expect(emailDeliveryNotification('PED-2026-000001', delivery('BOUNCED'))).toEqual({
      kind: 'error',
      message: 'O e-mail do pedido PED-2026-000001 foi rejeitado pelo destinatário.',
    });
  });
});
