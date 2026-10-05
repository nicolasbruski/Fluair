import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaOrderDraftsRepository } from '../../src/server/modules/orders/order-drafts.repository.js';
import type { OrderDraftPayloadCommand } from '../../src/server/modules/orders/orders.schemas.js';

const userId = '00000000-0000-4000-8000-000000000001';
const customerA = '10000000-0000-4000-8000-000000000001';
const customerB = '10000000-0000-4000-8000-000000000002';

interface FakeDraftRecord {
  id: string;
  userId: string;
  customerId: string;
  payload: OrderDraftPayloadCommand;
  revision: number;
  updatedAt: Date;
  customer: { id: string; code: string; legalName: string; active: boolean };
}

interface FakeUpsertArgument {
  create: { customerId: string; payload: OrderDraftPayloadCommand };
  update: { customerId: string; payload: OrderDraftPayloadCommand };
}

function payload(code: string): OrderDraftPayloadCommand {
  return {
    note: `Pedido ${code}`,
    cart: [
      {
        key: `product:${code}:30000000-0000-4000-8000-000000000001`,
        kind: 'STANDALONE_PRODUCT',
        code,
        description: 'Produto salvo',
        price: 10,
        taxRate: 0,
        referencePrice: 10,
        priceEdited: false,
        priceReference: 'UNIT',
        source: 'Lista v1',
        sourceVersionId: '30000000-0000-4000-8000-000000000001',
        quantity: 1,
        image: null,
      },
    ],
  };
}

function fakePrisma(initialCustomerId: string, initialPayload: OrderDraftPayloadCommand) {
  let record: FakeDraftRecord = {
    id: 'd0000000-0000-4000-8000-000000000001',
    userId,
    customerId: initialCustomerId,
    payload: initialPayload,
    revision: 1,
    updatedAt: new Date('2026-10-02T15:00:00.000Z'),
    customer: {
      id: initialCustomerId,
      code: initialCustomerId === customerA ? 'A' : 'B',
      legalName: `Cliente ${initialCustomerId === customerA ? 'A' : 'B'}`,
      active: true,
    },
  };
  const orderDraft = {
    findUnique: vi.fn(async (): Promise<FakeDraftRecord> => record),
    upsert: vi.fn(async ({ update }: FakeUpsertArgument): Promise<FakeDraftRecord> => {
      const data = update;
      const nextCustomerId = data.customerId;
      record = {
        ...record,
        customerId: nextCustomerId,
        payload: data.payload,
        revision: record ? record.revision + 1 : 1,
        updatedAt: new Date('2026-10-02T15:01:00.000Z'),
        customer: {
          id: nextCustomerId,
          code: nextCustomerId === customerA ? 'A' : 'B',
          legalName: `Cliente ${nextCustomerId === customerA ? 'A' : 'B'}`,
          active: true,
        },
      };
      return record;
    }),
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>): Promise<unknown> =>
      callback({ orderDraft }),
    ),
    orderDraft,
  } as unknown as PrismaClient;
  return { prisma, current: () => record };
}

describe('repositório do único pedido anterior salvo', () => {
  it('substitui o conteúdo do slot ao salvar o cliente fechado', async () => {
    const fake = fakePrisma(customerA, payload('A-01'));
    const repository = new PrismaOrderDraftsRepository(fake.prisma);

    const result = await repository.save(userId, {
      customerId: customerB,
      payload: payload('B-01'),
    });

    expect(result.customerId).toBe(customerB);
    expect(fake.current().payload.note).toBe('Pedido B-01');
    expect(fake.current().revision).toBe(2);
  });

  it('restaura o cliente salvo e coloca o pedido atual no mesmo slot', async () => {
    const fake = fakePrisma(customerA, payload('A-01'));
    const repository = new PrismaOrderDraftsRepository(fake.prisma);

    const result = await repository.swap(userId, {
      targetCustomerId: customerA,
      current: { customerId: customerB, payload: payload('B-01') },
    });

    expect(result.restored?.customerId).toBe(customerA);
    expect(result.draft?.customerId).toBe(customerB);
    expect(fake.current().payload.note).toBe('Pedido B-01');
  });

  it('mantém o slot existente quando o cliente atual não possui itens', async () => {
    const fake = fakePrisma(customerA, payload('A-01'));
    const repository = new PrismaOrderDraftsRepository(fake.prisma);

    const result = await repository.swap(userId, { targetCustomerId: customerB });

    expect(result.restored).toBeNull();
    expect(result.draft?.customerId).toBe(customerA);
    expect(fake.current().revision).toBe(1);
  });
});
