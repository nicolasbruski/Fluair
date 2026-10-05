import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { OrdersService } from '../../src/server/modules/orders/orders.service.js';

const customerId = '10000000-0000-4000-8000-000000000001';
const calculationId = '50000000-0000-4000-8000-000000000001';

describe('últimos preços vendidos', () => {
  it('retorna em lote o valor negociado mais recente por cliente e origem', async () => {
    const submittedAt = new Date('2026-10-02T15:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      {
        kind: 'STANDALONE_PRODUCT',
        codeSnapshot: 'P-100',
        sourceCalculationVersionId: null,
        negotiatedUnitPrice: new Prisma.Decimal('118.2500'),
        order: { id: 'order-product', number: 'PED-2026-000010', submittedAt },
      },
      {
        kind: 'KIT',
        codeSnapshot: 'KIT-01',
        sourceCalculationVersionId: calculationId,
        negotiatedUnitPrice: new Prisma.Decimal('920.0000'),
        order: { id: 'order-kit', number: 'PED-2026-000009', submittedAt },
      },
      {
        kind: 'STANDALONE_PRODUCT',
        codeSnapshot: 'P-100',
        sourceCalculationVersionId: null,
        negotiatedUnitPrice: new Prisma.Decimal('100.0000'),
        order: {
          id: 'older-order',
          number: 'PED-2026-000001',
          submittedAt: new Date('2026-09-01T12:00:00.000Z'),
        },
      },
    ]);
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente',
          cnpj: null,
          city: null,
          state: null,
          customerClass: null,
          customerSegment: null,
        }),
      },
      orderItem: { findMany },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).lastSalePrices({
      customerId,
      lines: [
        { key: 'product', kind: 'STANDALONE_PRODUCT', productCode: 'P-100' },
        { key: 'kit', kind: 'KIT', calculationId },
        { key: 'missing', kind: 'STANDALONE_PRODUCT', productCode: 'P-404' },
      ],
    });

    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { order: { customerId, status: 'SUBMITTED' } },
    });
    expect(result.data.prices).toEqual([
      {
        key: 'product',
        lastOrderPrice: {
          unitPrice: '118.2500',
          orderId: 'order-product',
          orderNumber: 'PED-2026-000010',
          orderedAt: submittedAt.toISOString(),
        },
      },
      {
        key: 'kit',
        lastOrderPrice: {
          unitPrice: '920.0000',
          orderId: 'order-kit',
          orderNumber: 'PED-2026-000009',
          orderedAt: submittedAt.toISOString(),
        },
      },
      { key: 'missing', lastOrderPrice: null },
    ]);
  });
});
