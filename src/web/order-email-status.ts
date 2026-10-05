import type { OrderDetailsEnvelope } from '../shared/orders.js';
import type { NotificationKind } from './notifications.js';

type OrderEmailDelivery = OrderDetailsEnvelope['data']['emailDeliveries'][number];

export interface EmailDeliveryNotification {
  kind: NotificationKind;
  message: string;
}

export function emailDeliveryNotification(
  orderNumber: string,
  delivery: OrderEmailDelivery,
): EmailDeliveryNotification | null {
  if (delivery.status === 'ACCEPTED') {
    return {
      kind: 'success',
      message: `E-mail do pedido ${orderNumber} aceito pelo provedor.`,
    };
  }
  if (delivery.status === 'DELIVERED') {
    return { kind: 'success', message: `E-mail do pedido ${orderNumber} entregue.` };
  }
  if (delivery.status === 'FAILED') {
    return {
      kind: 'error',
      message: delivery.publicError?.trim()
        ? `E-mail do pedido ${orderNumber}: ${delivery.publicError.trim()}`
        : `Não foi possível enviar o e-mail do pedido ${orderNumber}.`,
    };
  }
  if (delivery.status === 'BOUNCED') {
    return {
      kind: 'error',
      message: `O e-mail do pedido ${orderNumber} foi rejeitado pelo destinatário.`,
    };
  }
  return null;
}
