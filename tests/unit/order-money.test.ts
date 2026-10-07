import { describe, expect, it } from 'vitest';

import { orderAmount, orderLineAmount, orderUnitAmount } from '../../src/shared/order-money.js';

describe('valores monetários do carrinho', () => {
  it('mantém o imposto informativo e multiplica apenas o preço pela quantidade', () => {
    const product = { price: 100, taxRate: 15, quantity: 2 };

    expect(orderUnitAmount(product)).toBe(100);
    expect(orderLineAmount(product)).toBe(200);
    expect(orderAmount([product, { price: 50, taxRate: 0, quantity: 1 }])).toBe(250);
  });

  it('arredonda valores monetários em centavos', () => {
    expect(orderUnitAmount({ price: 19.999, taxRate: 3.25 })).toBe(20);
    expect(orderLineAmount({ price: 19.9, taxRate: 3.25, quantity: 3 })).toBe(59.7);
  });
  it('soma somente os quatro impostos selecionados ao preço-base', () => {
    const product = {
      price: 100,
      quantity: 2,
      taxes: {
        pis: { selected: true, rate: 1.65 },
        cofins: { selected: true, rate: 7.6 },
        icms: { selected: false, rate: 12 },
        ipi: { selected: false, rate: 5 },
      },
    };

    expect(orderUnitAmount(product)).toBe(109.25);
    expect(orderLineAmount(product)).toBe(218.5);
  });
});
