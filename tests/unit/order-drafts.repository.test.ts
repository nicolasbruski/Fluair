import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { PrismaOrderDraftsRepository } from '../../src/server/modules/orders/order-drafts.repository.js';
import type { OrderDraftPayloadCommand } from '../../src/server/modules/orders/orders.schemas.js';

const userId = '00000000-0000-4000-8000-000000000001';

function customerId(index: number): string {
  return `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
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

interface FakeRecord {
  id: string;
  userId: string;
  customerId: string;
  payload: OrderDraftPayloadCommand;
  revision: number;
  updatedAt: Date;
  customer: { id: string; code: string; legalName: string; active: boolean };
}

interface FindManyArgument {
  where: { userId: string };
  orderBy?: Array<{ updatedAt?: 'asc' | 'desc'; id?: 'asc' | 'desc' }>;
  take?: number;
}

interface FindUniqueArgument {
  where: { userId_customerId: { userId: string; customerId: string } };
}

interface FindFirstArgument {
  where: { userId: string; customerId: { notIn: string[] } };
}

interface CountArgument {
  where: { userId: string };
}

interface UpsertArgument extends FindUniqueArgument {
  create: {
    id: string;
    userId: string;
    customerId: string;
    payload: OrderDraftPayloadCommand;
  };
  update: { payload: OrderDraftPayloadCommand; revision: { increment: number } };
}

interface DeleteArgument {
  where: { id: string };
}

function fakePrisma(initial: FakeRecord[] = []) {
  let records = [...initial];
  let clock = 0;
  const projected = (record: FakeRecord) => record;
  const orderDraft = {
    findMany: vi.fn(async ({ where, orderBy, take }: FindManyArgument) => {
      const direction = orderBy?.[0]?.updatedAt ?? 'desc';
      return records
        .filter((record) => record.userId === where.userId)
        .sort((left, right) =>
          direction === 'asc'
            ? left.updatedAt.getTime() - right.updatedAt.getTime()
            : right.updatedAt.getTime() - left.updatedAt.getTime(),
        )
        .slice(0, take)
        .map(projected);
    }),
    findUnique: vi.fn(async ({ where }: FindUniqueArgument) => {
      const key = where.userId_customerId;
      return (
        records.find(
          (record) => record.userId === key.userId && record.customerId === key.customerId,
        ) ?? null
      );
    }),
    findFirst: vi.fn(async ({ where }: FindFirstArgument) =>
      records
        .filter(
          (record) =>
            record.userId === where.userId &&
            !where.customerId.notIn.includes(record.customerId),
        )
        .sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())[0] ?? null,
    ),
    count: vi.fn(async ({ where }: CountArgument) =>
      records.filter((record) => record.userId === where.userId).length,
    ),
    upsert: vi.fn(async ({ where, create, update }: UpsertArgument) => {
      const key = where.userId_customerId;
      const existing = records.find(
        (record) => record.userId === key.userId && record.customerId === key.customerId,
      );
      const updatedAt = new Date(`2026-10-06T12:${String(clock++).padStart(2, '0')}:00.000Z`);
      if (existing) {
        existing.payload = update.payload;
        existing.revision += 1;
        existing.updatedAt = updatedAt;
        return projected(existing);
      }
      const record: FakeRecord = {
        id: create.id,
        userId: create.userId,
        customerId: create.customerId,
        payload: create.payload,
        revision: 1,
        updatedAt,
        customer: {
          id: create.customerId,
          code: `C-${create.customerId.slice(-2)}`,
          legalName: `Cliente ${create.customerId.slice(-2)}`,
          active: true,
        },
      };
      records.push(record);
      return projected(record);
    }),
    delete: vi.fn(async ({ where }: DeleteArgument) => {
      const record = records.find((item) => item.id === where.id)!;
      records = records.filter((item) => item.id !== where.id);
      return record;
    }),
  };
  const transaction = { orderDraft, $queryRaw: vi.fn(async () => [{ id: userId }]) };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: unknown) => Promise<unknown>) =>
      callback(transaction),
    ),
    orderDraft,
  } as unknown as PrismaClient;
  return { prisma, records: () => records };
}

describe('repositório da fila de pedidos em andamento', () => {
  it('mantém pedidos de clientes diferentes e atualiza sem duplicar o mesmo cliente', async () => {
    const fake = fakePrisma();
    const repository = new PrismaOrderDraftsRepository(fake.prisma);

    await repository.save(userId, { customerId: customerId(1), payload: payload('A-01') });
    await repository.save(userId, { customerId: customerId(2), payload: payload('B-01') });
    const result = await repository.save(userId, {
      customerId: customerId(1),
      payload: payload('A-02'),
    });

    expect(result.drafts).toHaveLength(2);
    expect(result.draft.payload).toMatchObject({ note: 'Pedido A-02' });
    expect(result.draft.revision).toBe(2);
  });

  it('restaura o cliente de destino enquanto salva o pedido atual', async () => {
    const fake = fakePrisma();
    const repository = new PrismaOrderDraftsRepository(fake.prisma);
    await repository.save(userId, { customerId: customerId(1), payload: payload('A-01') });

    const result = await repository.swap(userId, {
      targetCustomerId: customerId(1),
      current: { customerId: customerId(2), payload: payload('B-01') },
    });

    expect(result.restored?.customerId).toBe(customerId(1));
    expect(result.drafts.map((draft) => draft.customerId)).toEqual([
      customerId(2),
      customerId(1),
    ]);
  });

  it('ao salvar o sexto cliente remove o pedido mais antigo da fila', async () => {
    const fake = fakePrisma();
    const repository = new PrismaOrderDraftsRepository(fake.prisma);
    for (let index = 1; index <= 5; index += 1) {
      await repository.save(userId, {
        customerId: customerId(index),
        payload: payload(`P-${index}`),
      });
    }

    const result = await repository.save(userId, {
      customerId: customerId(6),
      payload: payload('P-6'),
    });

    expect(result.evicted?.customerId).toBe(customerId(1));
    expect(result.drafts).toHaveLength(5);
    expect(result.drafts.map((draft) => draft.customerId)).toEqual([
      customerId(6),
      customerId(5),
      customerId(4),
      customerId(3),
      customerId(2),
    ]);
    expect(fake.records()).toHaveLength(5);
  });
});
