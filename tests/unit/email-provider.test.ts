import type { Resend } from 'resend';
import { describe, expect, it, vi } from 'vitest';

import {
  AllowlistEmailProvider,
  EmailProviderError,
  InMemoryEmailProvider,
  ResendEmailProvider,
} from '../../src/server/modules/email/email-provider.js';

const message = {
  to: ['usuario@fluair.test', 'operacao@example.com'],
  from: { address: 'pedidos@example.com', name: 'Fluair' },
  replyTo: null,
  subject: 'Pedido',
  html: '<p>Pedido</p>',
  text: 'Pedido',
  idempotencyKey: 'order-email/delivery-1',
};

describe('provedores de e-mail', () => {
  it('permite enderecos e dominios presentes na allowlist', async () => {
    const memory = new InMemoryEmailProvider();
    const provider = new AllowlistEmailProvider('@fluair.test,operacao@example.com', memory);
    await expect(provider.send(message)).resolves.toEqual({
      provider: 'memory',
      messageId: 'memory-1',
    });
    expect(memory.messages[0]?.idempotencyKey).toBe(message.idempotencyKey);
  });

  it('bloqueia antes do provedor qualquer destinatario fora da allowlist', async () => {
    const memory = new InMemoryEmailProvider();
    const provider = new AllowlistEmailProvider('operacao@example.com', memory);
    await expect(provider.send(message)).rejects.toMatchObject({
      kind: 'PERMANENT',
      code: 'recipient_not_allowed',
    });
    expect(memory.messages).toHaveLength(0);
  });

  it('oferece falhas controlaveis no adaptador em memoria', async () => {
    const memory = new InMemoryEmailProvider();
    memory.failure = new EmailProviderError('TRANSIENT', 'rate_limit', 'aguarde');
    await expect(memory.send(message)).rejects.toMatchObject({
      kind: 'TRANSIENT',
      code: 'rate_limit',
    });
  });

  it('classifica conflito de payload idempotente como falha permanente', async () => {
    const client = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: {
            statusCode: 409,
            name: 'invalid_idempotent_request',
            message: 'payload diferente',
          },
        }),
      },
    } as unknown as Resend;
    const provider = new ResendEmailProvider('re_test', client);

    await expect(provider.send(message)).rejects.toMatchObject({
      kind: 'PERMANENT',
      code: 'invalid_idempotent_request',
    });
  });
});
