import { describe, expect, it } from 'vitest';

import { parseEnvironment } from '../../src/server/config/env.js';

const base = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'mysql://test:test@localhost:3306/test',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('configuracao de entrega de e-mail', () => {
  it('mantem entrega real desabilitada por padrao', () => {
    expect(parseEnvironment(base).EMAIL_DELIVERY_ENABLED).toBe(false);
  });

  it('falha cedo se a entrega habilitada estiver incompleta', () => {
    expect(() => parseEnvironment({ ...base, EMAIL_DELIVERY_ENABLED: 'true' })).toThrow(
      /EMAIL_API_KEY/,
    );
  });

  it('exige allowlist em ambiente nao produtivo', () => {
    expect(() =>
      parseEnvironment({
        ...base,
        EMAIL_DELIVERY_ENABLED: 'true',
        EMAIL_API_KEY: 're_test',
        EMAIL_FROM: 'pedidos@example.com',
      }),
    ).toThrow(/EMAIL_ALLOWLIST/);
  });
});

describe('configuracao de aprovacao de preco', () => {
  it('usa sete dias por padrao e aceita prazo configurado', () => {
    expect(parseEnvironment(base).ORDER_PRICE_APPROVAL_VALIDITY_DAYS).toBe(7);
    expect(
      parseEnvironment({ ...base, ORDER_PRICE_APPROVAL_VALIDITY_DAYS: '15' })
        .ORDER_PRICE_APPROVAL_VALIDITY_DAYS,
    ).toBe(15);
  });

  it('rejeita prazo fora dos limites operacionais', () => {
    expect(() => parseEnvironment({ ...base, ORDER_PRICE_APPROVAL_VALIDITY_DAYS: '0' })).toThrow(
      /ORDER_PRICE_APPROVAL_VALIDITY_DAYS/,
    );
  });
});
