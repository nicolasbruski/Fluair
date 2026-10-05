import { describe, expect, it, vi } from 'vitest';

import {
  formatOrderNumber,
  PrismaOrderNumberGenerator,
} from '../../src/server/modules/orders/order-number.js';

describe('numeração de pedidos', () => {
  it('gera o formato anual legível com preenchimento de zeros', () => {
    expect(formatOrderNumber(2026, 1)).toBe('PED-2026-000001');
    expect(formatOrderNumber(2026, 999_999)).toBe('PED-2026-999999');
  });

  it('rejeita sequência inválida ou esgotada', () => {
    expect(() => formatOrderNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatOrderNumber(2026, 1_000_000)).toThrow(RangeError);
  });

  it('reserva a sequência no banco usando o ano UTC do relógio injetado', async () => {
    let reservationQuery: { strings: readonly string[] } | null = null;
    const transaction = {
      $executeRaw: vi.fn((query: { strings: readonly string[] }) => {
        reservationQuery = query;
        return Promise.resolve(1);
      }),
      $queryRaw: vi.fn().mockResolvedValue([{ sequence: 42n }]),
    };
    const generator = new PrismaOrderNumberGenerator();

    await expect(generator.next(transaction, new Date('2026-12-31T23:59:59.999Z'))).resolves.toBe(
      'PED-2026-000042',
    );
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(reservationQuery).not.toBeNull();
    const reservationSql = (
      reservationQuery as unknown as { strings: readonly string[] }
    ).strings.join(' ');
    expect(reservationSql).toContain('ON DUPLICATE KEY UPDATE');
    expect(reservationSql).toContain('LAST_INSERT_ID');
  });
});
