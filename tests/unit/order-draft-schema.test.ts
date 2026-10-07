import { describe, expect, it } from 'vitest';

import { orderDraftPayloadSchema } from '../../src/server/modules/orders/orders.schemas.js';

describe('schema do pedido em andamento', () => {
  it('aceita a faixa cadastrada com quantidade mínima zero', () => {
    const result = orderDraftPayloadSchema.safeParse({
      note: '',
      cart: [
        {
          key: 'product:P-01:30000000-0000-4000-8000-000000000001',
          kind: 'STANDALONE_PRODUCT',
          code: 'P-01',
          description: 'Produto da faixa inicial',
          price: 10,
          referencePrice: 10,
          priceEdited: false,
          priceReference: 'UNIT',
          source: 'Lista inicial',
          sourceVersionId: '30000000-0000-4000-8000-000000000001',
          minimumOrderQuantity: 0,
          maximumOrderQuantity: 49,
          quantity: 1,
          image: null,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
