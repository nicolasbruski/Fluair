import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  OrderPriceApprovalConsumptionConflictError,
  PrismaOrdersRepository,
} from '../../src/server/modules/orders/orders.repository.js';
import type { CreateOrderSnapshot } from '../../src/shared/orders.js';

function orderInput(): CreateOrderSnapshot {
  return {
    idempotencyKey: 'submit-001',
    contentHash: 'a'.repeat(64),
    customer: {
      id: '10000000-0000-4000-8000-000000000001',
      code: 'CLI-001',
      legalName: 'Cliente Original',
      taxId: '12345678000199',
      city: 'Curitiba',
      state: 'PR',
      customerClass: { id: 'class-1', code: 'IND', name: 'Indústria' },
      customerSegment: { id: 'segment-1', code: 'OEM', name: 'Fabricante' },
    },
    creator: {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'Usuário Original',
      email: 'usuario@fluair.test',
    },
    note: 'Condição negociada',
    totalQuantity: '3.0000',
    totalAmount: '123456789012345.6789',
    items: [
      {
        kind: 'STANDALONE_PRODUCT',
        sourceProductId: 'product-1',
        sourceKitId: null,
        sourceCalculationVersionId: null,
        sourcePriceListVersionId: 'version-1',
        priceList: {
          id: 'list-1',
          code: 'AVULSOS',
          name: 'Produtos avulsos',
          type: 'STANDALONE_PRODUCT',
          version: 7,
        },
        calculationVersion: null,
        priceReference: 'UNIT',
        code: 'PROD-01',
        description: 'Produto original',
        reference: 'REF-01',
        unit: 'UN',
        quantity: '2.0000',
        referenceUnitPrice: '0.1234',
        negotiatedUnitPrice: '0.1234',
        minimumReferencePrice: '0.1234',
        normalReferencePrice: '0.1234',
        ipiRate: '3.2500',
        icmsRate: '12.0000',
        subtotal: '0.2468',
      },
      {
        kind: 'KIT',
        sourceProductId: null,
        sourceKitId: 'kit-1',
        sourceCalculationVersionId: 'calculation-1',
        sourcePriceListVersionId: 'version-2',
        priceList: {
          id: 'list-2',
          code: 'KITS',
          name: 'Componentes',
          type: 'KIT_COMPONENT',
          version: 3,
        },
        calculationVersion: 11,
        priceReference: 'NORMAL',
        code: 'KIT-01',
        description: 'Kit original',
        reference: null,
        unit: 'UN',
        quantity: '1.0000',
        referenceUnitPrice: '123456789012345.4321',
        negotiatedUnitPrice: '123456789012345.4321',
        minimumReferencePrice: '100000000000000.0000',
        normalReferencePrice: '123456789012345.4321',
        ipiRate: null,
        icmsRate: null,
        subtotal: '123456789012345.4321',
      },
    ],
    delivery: {
      recipients: ['usuario@fluair.test', 'operacao@fluair.test'],
      fromAddress: 'pedidos@fluair.test',
      fromName: 'Fluair',
      replyTo: null,
      templateVersion: 'order-v1',
      idempotencyKey: 'delivery-001',
      contentHash: 'b'.repeat(64),
    },
  };
}

function fakePrisma(
  options: { failAudit?: boolean; failDelivery?: boolean; rejectReservation?: boolean } = {},
) {
  const committed = {
    orders: [] as unknown[],
    deliveries: [] as unknown[],
    audits: [] as unknown[],
    approvalUpdates: [] as unknown[],
    draftDeletes: [] as unknown[],
  };
  const transaction = vi.fn(async (callback: (transaction: unknown) => Promise<unknown>) => {
    const staged = {
      orders: [] as unknown[],
      deliveries: [] as unknown[],
      audits: [] as unknown[],
      approvalUpdates: [] as unknown[],
      draftDeletes: [] as unknown[],
    };
    const client = {
      order: { create: vi.fn(async (data) => void staged.orders.push(data)) },
      orderDraft: {
        deleteMany: vi.fn(async (data) => {
          staged.draftDeletes.push(data);
          return { count: 0 };
        }),
      },
      orderEmailDelivery: {
        create: vi.fn(async (data) => {
          if (options.failDelivery) throw new Error('delivery failed');
          staged.deliveries.push(data);
        }),
      },
      orderPriceApprovalRequest: {
        updateMany: vi.fn(async (data) => {
          if (options.rejectReservation && staged.approvalUpdates.length === 0) return { count: 0 };
          staged.approvalUpdates.push(data);
          return { count: 1 };
        }),
      },
      auditLog: {
        create: vi.fn(async (data) => {
          if (options.failAudit) throw new Error('audit failed');
          staged.audits.push(data);
        }),
      },
    };
    const result = await callback(client);
    committed.orders.push(...staged.orders);
    committed.deliveries.push(...staged.deliveries);
    committed.audits.push(...staged.audits);
    committed.approvalUpdates.push(...staged.approvalUpdates);
    committed.draftDeletes.push(...staged.draftDeletes);
    return result;
  });
  return { client: { $transaction: transaction } as unknown as PrismaClient, committed };
}

function repository(prisma: PrismaClient) {
  let id = 0;
  return new PrismaOrdersRepository(prisma, {
    clock: { now: () => new Date('2026-09-29T15:00:00.000Z') },
    idGenerator: () => `generated-${++id}`,
    numberGenerator: { next: vi.fn().mockResolvedValue('PED-2026-000001') },
  });
}

describe('repositório transacional de pedidos', () => {
  it('grava pedido misto, snapshots, entrega pendente e auditoria no mesmo commit', async () => {
    const prisma = fakePrisma();
    const input = orderInput();
    const result = await repository(prisma.client).createWithFirstDelivery(input, {
      requestId: 'request-001',
    });

    expect(result.order).toEqual({
      id: 'generated-1',
      number: 'PED-2026-000001',
      status: 'SUBMITTED',
      submittedAt: '2026-09-29T15:00:00.000Z',
    });
    expect(result.emailDelivery).toMatchObject({ id: 'generated-2', status: 'PENDING' });
    expect(prisma.committed.orders).toHaveLength(1);
    expect(prisma.committed.deliveries).toHaveLength(1);
    expect(prisma.committed.audits).toHaveLength(1);
    expect(prisma.committed.draftDeletes).toEqual([
      {
        where: {
          userId: input.creator.id,
          customerId: input.customer.id,
        },
      },
    ]);

    const orderCreate = prisma.committed.orders[0] as {
      data: {
        customerNameSnapshot: string;
        totalAmount: { toFixed(scale: number): string };
        items: { createMany: { data: Array<Record<string, unknown>> } };
      };
    };
    expect(orderCreate.data.customerNameSnapshot).toBe('Cliente Original');
    expect(orderCreate.data.totalAmount.toFixed(4)).toBe('123456789012345.6789');
    expect(orderCreate.data.items.createMany.data).toHaveLength(2);
    expect(
      (
        orderCreate.data.items.createMany.data[0]!.subtotal as { toFixed(scale: number): string }
      ).toFixed(4),
    ).toBe('0.2468');
    expect(orderCreate.data.items.createMany.data[1]).toMatchObject({
      kind: 'KIT',
      codeSnapshot: 'KIT-01',
      sourceCalculationVersionSnapshot: 11,
      sourcePriceListVersionSnapshot: 3,
    });

    input.customer.legalName = 'Cliente alterado depois';
    input.creator.name = 'Usuário alterado depois';
    input.items[0]!.description = 'Produto alterado depois';
    expect(orderCreate.data.customerNameSnapshot).toBe('Cliente Original');
    expect(orderCreate.data.items.createMany.data[0]!.descriptionSnapshot).toBe('Produto original');
  });

  it('não confirma nenhum registro quando a auditoria falha', async () => {
    const prisma = fakePrisma({ failAudit: true });

    await expect(
      repository(prisma.client).createWithFirstDelivery(orderInput(), { requestId: 'request-002' }),
    ).rejects.toThrow('audit failed');
    expect(prisma.committed.orders).toHaveLength(0);
    expect(prisma.committed.deliveries).toHaveLength(0);
    expect(prisma.committed.audits).toHaveLength(0);
  });

  it('reserva, vincula e audita o consumo da aprovação no mesmo commit', async () => {
    const prisma = fakePrisma();
    const input = orderInput();
    input.priceApproval = {
      id: 'approval-1',
      expectedVersion: 2,
      contentHash: 'c'.repeat(64),
      hashVersion: 1,
    };

    await repository(prisma.client).createWithFirstDelivery(input, { requestId: 'request-003' });

    expect(prisma.committed.orders).toHaveLength(1);
    expect(prisma.committed.deliveries).toHaveLength(1);
    expect(prisma.committed.approvalUpdates).toHaveLength(2);
    expect(prisma.committed.approvalUpdates[0]).toMatchObject({
      where: { id: 'approval-1', status: 'APPROVED', version: 2 },
      data: { status: 'CONSUMED' },
    });
    expect(prisma.committed.approvalUpdates[1]).toMatchObject({
      where: { id: 'approval-1', status: 'CONSUMED', version: 3 },
      data: { consumedOrderId: 'generated-1' },
    });
    expect(prisma.committed.audits).toHaveLength(2);
    expect(prisma.committed.audits[1]).toMatchObject({
      data: {
        action: 'ORDER_PRICE_APPROVAL_CONSUMED',
        entityId: 'approval-1',
      },
    });
  });

  it('reverte a reserva da aprovação quando a entrega pendente falha', async () => {
    const prisma = fakePrisma({ failDelivery: true });
    const input = orderInput();
    input.priceApproval = {
      id: 'approval-1',
      expectedVersion: 2,
      contentHash: 'c'.repeat(64),
      hashVersion: 1,
    };

    await expect(
      repository(prisma.client).createWithFirstDelivery(input, { requestId: 'request-004' }),
    ).rejects.toThrow('delivery failed');
    expect(prisma.committed.orders).toHaveLength(0);
    expect(prisma.committed.deliveries).toHaveLength(0);
    expect(prisma.committed.approvalUpdates).toHaveLength(0);
    expect(prisma.committed.audits).toHaveLength(0);
  });

  it('impede duas transações de reservarem a mesma aprovação', async () => {
    const prisma = fakePrisma({ rejectReservation: true });
    const input = orderInput();
    input.priceApproval = {
      id: 'approval-1',
      expectedVersion: 2,
      contentHash: 'c'.repeat(64),
      hashVersion: 1,
    };

    await expect(
      repository(prisma.client).createWithFirstDelivery(input, { requestId: 'request-005' }),
    ).rejects.toBeInstanceOf(OrderPriceApprovalConsumptionConflictError);
    expect(prisma.committed.orders).toHaveLength(0);
    expect(prisma.committed.deliveries).toHaveLength(0);
    expect(prisma.committed.approvalUpdates).toHaveLength(0);
  });
});
