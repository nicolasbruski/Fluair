import { describe, expect, it } from 'vitest';

import { isOrderQuantityInRange, orderTotalQuantity } from '../../src/shared/order-quantity.js';

describe('quantidade total e faixas do pedido', () => {
  it('usa uma soma única para carrinho vazio, misto e múltiplas quantidades', () => {
    expect(orderTotalQuantity([])).toBe(0);
    expect(orderTotalQuantity([{ quantity: 1 }])).toBe(1);
    expect(orderTotalQuantity([{ quantity: 49 }, { quantity: 1 }, { quantity: 50 }])).toBe(100);
  });

  it.each([
    { total: 0, minimum: 0, maximum: 49, compatible: true },
    { total: 1, minimum: 0, maximum: 49, compatible: true },
    { total: 49, minimum: 0, maximum: 49, compatible: true },
    { total: 50, minimum: 0, maximum: 49, compatible: false },
    { total: 50, minimum: 50, maximum: 99, compatible: true },
    { total: 99, minimum: 50, maximum: 99, compatible: true },
    { total: 100, minimum: 50, maximum: 99, compatible: false },
    { total: 99, minimum: 100, maximum: null, compatible: false },
    { total: 100, minimum: 100, maximum: null, compatible: true },
    { total: 100, minimum: null, maximum: null, compatible: true },
  ])(
    'avalia inclusivamente $total na faixa $minimum–$maximum',
    ({ total, minimum, maximum, compatible }) => {
      expect(isOrderQuantityInRange(total, minimum, maximum)).toBe(compatible);
    },
  );
});
