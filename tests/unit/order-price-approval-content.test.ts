import { describe, expect, it } from 'vitest';

import type {
  CanonicalOrderPriceApprovalContent,
  OrderPriceApprovalItemSnapshot,
} from '../../src/shared/order-price-approvals.js';
import {
  hashOrderPriceApprovalContent,
  InvalidOrderPriceApprovalContentError,
  ORDER_PRICE_APPROVAL_HASH_VERSION,
} from '../../src/server/modules/order-price-approvals/order-price-approval-content.js';
import {
  canReviewOrderPriceApproval,
  canTransitionOrderPriceApproval,
} from '../../src/server/modules/order-price-approvals/order-price-approval-state.js';

function item(
  overrides: Partial<OrderPriceApprovalItemSnapshot> = {},
): OrderPriceApprovalItemSnapshot {
  return {
    lineNumber: 1,
    kind: 'STANDALONE_PRODUCT',
    requiresApproval: true,
    sourceProductId: 'product-1',
    sourceKitId: null,
    sourceCalculationVersionId: null,
    sourcePriceListVersionId: 'price-version-1',
    priceList: {
      id: 'price-list-1',
      code: 'ATACADO-50',
      name: 'Atacado 50-99',
      type: 'STANDALONE_PRODUCT',
      version: 3,
      minimumOrderQuantity: 50,
      maximumOrderQuantity: 99,
    },
    calculationVersion: null,
    priceReference: 'UNIT',
    code: 'P-001',
    description: 'Produto',
    reference: 'REF-1',
    unit: 'UN',
    quantity: '60',
    referenceUnitPrice: '100',
    minimumUnitPrice: '100',
    negotiatedUnitPrice: '92',
    minimumSubtotal: '6000',
    negotiatedSubtotal: '5520',
    exceptionUnitAmount: '8',
    exceptionTotalAmount: '480',
    ipiRate: '0',
    icmsRate: '18',
    ...overrides,
  };
}

function content(): CanonicalOrderPriceApprovalContent {
  return {
    requesterId: 'user-1',
    customerId: 'customer-1',
    customerClassId: 'class-1',
    customerSegmentId: 'segment-1',
    items: [
      item(),
      item({
        lineNumber: 2,
        kind: 'KIT',
        requiresApproval: false,
        sourceProductId: null,
        sourceKitId: 'kit-1',
        sourceCalculationVersionId: 'calculation-version-1',
        sourcePriceListVersionId: 'price-version-2',
        priceList: {
          id: 'price-list-2',
          code: 'KIT',
          name: 'Componentes',
          type: 'KIT_COMPONENT',
          version: 7,
          minimumOrderQuantity: null,
          maximumOrderQuantity: null,
        },
        calculationVersion: 4,
        priceReference: 'MINIMUM',
        code: 'K-001',
        description: 'Kit',
        quantity: '2.2500',
        referenceUnitPrice: '120.1234',
        minimumUnitPrice: '120.1234',
        negotiatedUnitPrice: '120.1234',
        minimumSubtotal: '270.2777',
        negotiatedSubtotal: '270.2777',
        exceptionUnitAmount: '0',
        exceptionTotalAmount: '0',
      }),
    ],
    totalQuantity: '62.2500',
    minimumTotalAmount: '6270.2777',
    requestedTotalAmount: '5790.2777',
  };
}

describe('conteúdo canônico da aprovação de preço', () => {
  it('preserva quatro casas e gera hash estável para carrinho misto reordenado', () => {
    const original = content();
    const reordered = { ...original, items: [...original.items].reverse() };

    const first = hashOrderPriceApprovalContent(original);
    const second = hashOrderPriceApprovalContent(reordered);

    expect(first.version).toBe(ORDER_PRICE_APPROVAL_HASH_VERSION);
    expect(first.hash).toBe(second.hash);
    expect(first.canonical).toContain('"negotiatedUnitPrice":"120.1234"');
    expect(first.canonical).toContain('"quantity":"60.0000"');
  });

  it.each([
    [
      'requesterId',
      (value: CanonicalOrderPriceApprovalContent) => ({ ...value, requesterId: 'user-2' }),
    ],
    [
      'customerId',
      (value: CanonicalOrderPriceApprovalContent) => ({ ...value, customerId: 'customer-2' }),
    ],
    [
      'quantity',
      (value: CanonicalOrderPriceApprovalContent) => ({
        ...value,
        items: value.items.map((line, index) => (index === 0 ? { ...line, quantity: '61' } : line)),
      }),
    ],
    [
      'minimumUnitPrice',
      (value: CanonicalOrderPriceApprovalContent) => ({
        ...value,
        items: value.items.map((line, index) =>
          index === 0 ? { ...line, minimumUnitPrice: '101' } : line,
        ),
      }),
    ],
  ])('altera o hash quando muda %s protegido', (_field, mutate) => {
    const original = content();
    expect(hashOrderPriceApprovalContent(mutate(original)).hash).not.toBe(
      hashOrderPriceApprovalContent(original).hash,
    );
  });

  it('protege todas as origens, versões, faixas, referências, subtotais e totais', () => {
    const original = content();
    const changeLine = (
      index: number,
      changes: Partial<OrderPriceApprovalItemSnapshot>,
    ): CanonicalOrderPriceApprovalContent => ({
      ...original,
      items: original.items.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...changes } : line,
      ),
    });
    const changePriceList = (
      changes: Partial<OrderPriceApprovalItemSnapshot['priceList']>,
    ): CanonicalOrderPriceApprovalContent =>
      changeLine(0, { priceList: { ...original.items[0]!.priceList, ...changes } });
    const mutations: Array<[string, CanonicalOrderPriceApprovalContent]> = [
      ['customerClassId', { ...original, customerClassId: 'class-2' }],
      ['customerSegmentId', { ...original, customerSegmentId: 'segment-2' }],
      ['kind', changeLine(0, { kind: 'KIT' })],
      ['code', changeLine(0, { code: 'P-002' })],
      ['sourceProductId', changeLine(0, { sourceProductId: 'product-2' })],
      ['sourceKitId', changeLine(0, { sourceKitId: 'kit-2' })],
      [
        'sourceCalculationVersionId',
        changeLine(0, { sourceCalculationVersionId: 'calculation-version-2' }),
      ],
      ['sourcePriceListVersionId', changeLine(0, { sourcePriceListVersionId: 'price-version-9' })],
      ['priceListId', changePriceList({ id: 'price-list-9' })],
      ['priceListVersion', changePriceList({ version: 4 })],
      ['minimumOrderQuantity', changePriceList({ minimumOrderQuantity: 51 })],
      ['maximumOrderQuantity', changePriceList({ maximumOrderQuantity: 100 })],
      ['calculationVersion', changeLine(1, { calculationVersion: 5 })],
      ['priceReference', changeLine(1, { priceReference: 'NORMAL' })],
      ['referenceUnitPrice', changeLine(0, { referenceUnitPrice: '102' })],
      ['negotiatedUnitPrice', changeLine(0, { negotiatedUnitPrice: '93' })],
      ['minimumSubtotal', changeLine(0, { minimumSubtotal: '6060' })],
      ['negotiatedSubtotal', changeLine(0, { negotiatedSubtotal: '5580' })],
      ['totalQuantity', { ...original, totalQuantity: '63.2500' }],
      ['minimumTotalAmount', { ...original, minimumTotalAmount: '6271.2777' }],
      ['requestedTotalAmount', { ...original, requestedTotalAmount: '5791.2777' }],
      [
        'itemAdded',
        { ...original, items: [...original.items, item({ lineNumber: 3, code: 'P-003' })] },
      ],
      ['itemRemoved', { ...original, items: original.items.slice(0, 1) }],
    ];
    const originalHash = hashOrderPriceApprovalContent(original).hash;

    for (const [field, mutated] of mutations) {
      expect(hashOrderPriceApprovalContent(mutated).hash, field).not.toBe(originalHash);
    }
  });

  it('ignora a observação final do pedido e rejeita origem duplicada', () => {
    const original = content();
    const withNote = { ...original, orderNote: 'Observação fora da autorização' };
    expect(hashOrderPriceApprovalContent(withNote).hash).toBe(
      hashOrderPriceApprovalContent(original).hash,
    );

    expect(() =>
      hashOrderPriceApprovalContent({
        ...original,
        items: [original.items[0]!, original.items[0]!],
      }),
    ).toThrow(InvalidOrderPriceApprovalContentError);
  });
});

describe('máquina de estados da aprovação de preço', () => {
  it('aceita somente as transições especificadas e impede autoavaliação', () => {
    expect(canTransitionOrderPriceApproval('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionOrderPriceApproval('APPROVED', 'CONSUMED')).toBe(true);
    expect(canTransitionOrderPriceApproval('REJECTED', 'PENDING')).toBe(false);
    expect(canReviewOrderPriceApproval('user-1', 'user-1')).toBe(false);
    expect(canReviewOrderPriceApproval('user-1', 'user-2')).toBe(true);
  });
});
