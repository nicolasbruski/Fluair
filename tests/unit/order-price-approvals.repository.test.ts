import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { CreateOrderPriceApprovalSnapshot } from '../../src/shared/order-price-approvals.js';
import {
  OrderPriceApprovalIdempotencyConflictError,
  PrismaOrderPriceApprovalsRepository,
} from '../../src/server/modules/order-price-approvals/order-price-approvals.repository.js';
import {
  OrderPriceApprovalNotRequiredError,
  OrderPriceApprovalsService,
} from '../../src/server/modules/order-price-approvals/order-price-approvals.service.js';

function snapshot(
  overrides: Partial<CreateOrderPriceApprovalSnapshot> = {},
): CreateOrderPriceApprovalSnapshot {
  return {
    idempotencyKey: 'approval-001',
    contentHash: 'a'.repeat(64),
    hashVersion: 1,
    requester: { id: 'user-1', name: 'Solicitante', email: 'user@example.com' },
    customer: {
      id: 'customer-1',
      code: 'C-001',
      legalName: 'Cliente',
      customerClass: { id: 'class-1', code: 'A', name: 'Classe A' },
      customerSegment: { id: 'segment-1', code: 'IND', name: 'Indústria' },
    },
    justification: 'Condição comercial específica para este pedido.',
    totalQuantity: '60.0000',
    minimumTotalAmount: '6000.0000',
    requestedTotalAmount: '5520.0000',
    exceptionAmount: '480.0000',
    items: [
      {
        lineNumber: 1,
        kind: 'STANDALONE_PRODUCT',
        requiresApproval: true,
        sourceProductId: 'product-1',
        sourceKitId: null,
        sourceCalculationVersionId: null,
        sourcePriceListVersionId: 'price-version-1',
        priceList: {
          id: 'price-list-1',
          code: 'ATACADO',
          name: 'Atacado 50-99',
          type: 'STANDALONE_PRODUCT',
          version: 2,
          minimumOrderQuantity: 50,
          maximumOrderQuantity: 99,
        },
        calculationVersion: null,
        priceReference: 'UNIT',
        code: 'P-001',
        description: 'Produto',
        reference: 'REF',
        unit: 'UN',
        quantity: '60.0000',
        referenceUnitPrice: '100.0000',
        minimumUnitPrice: '100.0000',
        negotiatedUnitPrice: '92.0000',
        minimumSubtotal: '6000.0000',
        negotiatedSubtotal: '5520.0000',
        exceptionUnitAmount: '8.0000',
        exceptionTotalAmount: '480.0000',
        ipiRate: '0.0000',
        icmsRate: '18.0000',
      },
    ],
    ...overrides,
  };
}

function fakePrisma(options: { failAudit?: boolean } = {}) {
  const committed = {
    rows: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
    findManyQueries: [] as Record<string, unknown>[],
  };

  function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
    const composite = where.requestedByUserId_idempotencyKey as
      { requestedByUserId: string; idempotencyKey: string } | undefined;
    if (composite) {
      return (
        row.requestedByUserId === composite.requestedByUserId &&
        row.idempotencyKey === composite.idempotencyKey
      );
    }
    return (
      (!where.id || row.id === where.id) &&
      (!where.requestedByUserId || row.requestedByUserId === where.requestedByUserId) &&
      (!where.customerId || row.customerId === where.customerId) &&
      (!where.status || row.status === where.status)
    );
  }

  const requestDelegate = {
    findUnique: async (args: {
      where: Record<string, unknown>;
      select?: { contentHash?: boolean };
    }) => {
      const row = committed.rows.find((candidate) => matches(candidate, args.where));
      if (!row) return null;
      return args.select ? { contentHash: row.contentHash } : row;
    },
    findFirst: async (args: { where: Record<string, unknown> }) =>
      committed.rows.find((candidate) => matches(candidate, args.where)) ?? null,
    updateMany: async (args: {
      where: { id: string; requestedByUserId?: string; status: string; version?: number };
      data: { status: string; version: { increment: number } };
    }) => {
      const row = committed.rows.find(
        (candidate) =>
          candidate.id === args.where.id &&
          candidate.status === args.where.status &&
          (!args.where.requestedByUserId ||
            candidate.requestedByUserId === args.where.requestedByUserId) &&
          (args.where.version === undefined || candidate.version === args.where.version),
      );
      if (!row) return { count: 0 };
      Object.assign(row, args.data, {
        version: Number(row.version) + args.data.version.increment,
        updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      });
      return { count: 1 };
    },
    count: async (args: { where: Record<string, unknown> }) =>
      committed.rows.filter((candidate) => matches(candidate, args.where)).length,
    findMany: async (args: { where: Record<string, unknown>; skip?: number; take?: number }) => {
      committed.findManyQueries.push(args as unknown as Record<string, unknown>);
      const matching = committed.rows.filter((candidate) => matches(candidate, args.where));
      return matching.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? matching.length));
    },
  };

  const prisma = {
    committed,
    orderPriceApprovalRequest: requestDelegate,
    $transaction: async (callback: (transaction: Record<string, unknown>) => Promise<unknown>) => {
      let stagedRow: Record<string, unknown> | null = null;
      const stagedAudits: Record<string, unknown>[] = [];
      const transaction = {
        orderPriceApprovalRequest: {
          updateMany: requestDelegate.updateMany,
          create: async ({ data }: { data: Record<string, unknown> }) => {
            const nested = data.items as { createMany: { data: Record<string, unknown>[] } };
            stagedRow = {
              ...data,
              status: 'PENDING',
              items: nested.createMany.data,
              reviewedByUserId: null,
              reviewedByNameSnapshot: null,
              reviewedByEmailSnapshot: null,
              reviewNote: null,
              reviewedAt: null,
              approvedUntil: null,
              consumedOrderId: null,
              consumedAt: null,
              consumedOrder: null,
            };
            return stagedRow;
          },
        },
        auditLog: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            if (options.failAudit) throw new Error('audit failed');
            stagedAudits.push(data);
            return data;
          },
        },
      };
      const result = await callback(transaction);
      if (stagedRow) committed.rows.push(stagedRow);
      committed.audits.push(...stagedAudits);
      return result;
    },
  };
  return prisma as unknown as PrismaClient & { committed: typeof committed };
}

describe('PrismaOrderPriceApprovalsRepository', () => {
  const now = new Date('2026-09-30T15:00:00.000Z');

  it('cria solicitação, itens e auditoria sanitizada no mesmo commit', async () => {
    const prisma = fakePrisma();
    const ids = ['request-1', 'item-1'];
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => ids.shift() ?? 'unexpected-id',
    });

    const result = await repository.create(snapshot(), { requestId: 'http-request-1' });

    expect(result).toMatchObject({
      replayed: false,
      approval: { id: 'request-1', status: 'PENDING' },
    });
    expect(prisma.committed.rows).toHaveLength(1);
    expect(prisma.committed.rows[0]?.items as unknown[]).toHaveLength(1);
    expect(prisma.committed.audits).toHaveLength(1);
    expect(prisma.committed.audits[0]).toMatchObject({
      action: 'ORDER_PRICE_APPROVAL_REQUESTED',
      entityId: 'request-1',
      requestId: 'http-request-1',
    });
    expect(JSON.stringify(prisma.committed.audits)).not.toContain('Condição comercial');
  });

  it('recupera replay de mesmo conteúdo e rejeita a chave com conteúdo diferente', async () => {
    const prisma = fakePrisma();
    const ids = ['request-1', 'item-1'];
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => ids.shift() ?? 'unused-id',
    });
    await repository.create(snapshot(), { requestId: 'request-1' });

    const replay = await repository.create(snapshot(), { requestId: 'request-2' });
    expect(replay.replayed).toBe(true);
    expect(replay.approval.id).toBe('request-1');
    expect(prisma.committed.rows).toHaveLength(1);
    expect(prisma.committed.audits).toHaveLength(1);

    await expect(
      repository.create(snapshot({ contentHash: 'b'.repeat(64) }), { requestId: 'request-3' }),
    ).rejects.toBeInstanceOf(OrderPriceApprovalIdempotencyConflictError);
  });

  it('reverte solicitação e itens quando a auditoria falha', async () => {
    const prisma = fakePrisma({ failAudit: true });
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => 'fixed-id',
    });

    await expect(repository.create(snapshot(), { requestId: 'request-1' })).rejects.toThrow(
      'audit failed',
    );
    expect(prisma.committed.rows).toHaveLength(0);
    expect(prisma.committed.audits).toHaveLength(0);
  });

  it('faz atualização condicional por estado e versão', async () => {
    const prisma = fakePrisma();
    const ids = ['request-1', 'item-1'];
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => ids.shift() ?? 'unused-id',
    });
    await repository.create(snapshot(), { requestId: 'request-1' });

    await expect(
      repository.conditionalUpdate({
        id: 'request-1',
        expectedStatus: 'PENDING',
        expectedVersion: 1,
        status: 'APPROVED',
      }),
    ).resolves.toBe(true);
    await expect(
      repository.conditionalUpdate({
        id: 'request-1',
        expectedStatus: 'PENDING',
        expectedVersion: 1,
        status: 'REJECTED',
      }),
    ).resolves.toBe(false);
  });

  it('pagina a fila pendente da mais antiga e calcula o tempo de espera', async () => {
    const prisma = fakePrisma();
    const ids = ['request-1', 'item-1'];
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => ids.shift() ?? 'unused-id',
    });
    await repository.create(snapshot(), { requestId: 'request-1' });

    const result = await repository.listAdmin({
      status: 'PENDING',
      requesterId: 'user-1',
      customerId: 'customer-1',
      page: 1,
      pageSize: 20,
      now: new Date('2026-09-30T15:01:30.000Z'),
    });

    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(result.data[0]).toMatchObject({
      id: 'request-1',
      status: 'PENDING',
      waitingSeconds: 90,
      exceptionCount: 1,
      requestedTotalAmount: '5520.0000',
      exceptionAmount: '480.0000',
    });
    expect(result.data[0]).not.toHaveProperty('items');
    expect(prisma.committed.findManyQueries[0]).toMatchObject({
      where: {
        status: 'PENDING',
        requestedByUserId: 'user-1',
        customerId: 'customer-1',
      },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    });
  });
  it('substitui somente uma solicitacao pendente do mesmo solicitante e audita as duas mudancas', async () => {
    const prisma = fakePrisma();
    const ids = ['request-1', 'item-1', 'request-2', 'item-2'];
    const repository = new PrismaOrderPriceApprovalsRepository(prisma, {
      clock: { now: () => now },
      idGenerator: () => ids.shift() ?? 'unused-id',
    });
    await repository.create(snapshot(), { requestId: 'request-1' });

    const replacement = await repository.create(
      snapshot({
        idempotencyKey: 'approval-002',
        contentHash: 'b'.repeat(64),
        supersedesRequestId: 'request-1',
      }),
      { requestId: 'request-2' },
    );

    expect(replacement.approval.id).toBe('request-2');
    expect(prisma.committed.rows[0]).toMatchObject({ status: 'SUPERSEDED', version: 2 });
    expect(prisma.committed.audits.map((audit) => audit.action)).toEqual([
      'ORDER_PRICE_APPROVAL_REQUESTED',
      'ORDER_PRICE_APPROVAL_SUPERSEDED',
      'ORDER_PRICE_APPROVAL_REQUESTED',
    ]);
  });
});

describe('OrderPriceApprovalsService', () => {
  it('exige ao menos uma linha abaixo do mínimo antes de persistir', async () => {
    const repository = { create: vi.fn() };
    const service = new OrderPriceApprovalsService(
      repository as unknown as ConstructorParameters<typeof OrderPriceApprovalsService>[0],
    );
    const input = snapshot({
      items: snapshot().items.map((item) => ({ ...item, requiresApproval: false })),
    });

    await expect(
      service.persistResolvedSnapshot(input, { requestId: 'request-1' }),
    ).rejects.toBeInstanceOf(OrderPriceApprovalNotRequiredError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe('decisao e expiracao no repositorio de aprovacoes', () => {
  it('persiste decisao e auditoria na mesma transacao', async () => {
    const updateMany = vi.fn(async (_input: unknown) => ({ count: 1 }));
    const auditCreate = vi.fn(async (_input: unknown) => ({}));
    const transaction = {
      orderPriceApprovalRequest: {
        findUnique: vi.fn().mockResolvedValue({
          requestedByUserId: 'user-1',
          customerId: 'customer-1',
          contentHash: 'a'.repeat(64),
          hashVersion: 1,
          exceptionAmount: new Prisma.Decimal('80.0000'),
          items: [{ requiresApproval: true }, { requiresApproval: false }],
        }),
        updateMany,
      },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      $transaction: (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    } as unknown as PrismaClient;
    const repository = new PrismaOrderPriceApprovalsRepository(prisma);
    const reviewedAt = new Date('2026-10-01T12:00:00.000Z');
    const approvedUntil = new Date('2026-10-08T12:00:00.000Z');

    await expect(
      repository.decide({
        id: 'approval-1',
        expectedVersion: 1,
        status: 'APPROVED',
        reviewer: { id: 'reviewer-1', name: 'Revisora', email: 'reviewer@example.com' },
        reviewNote: 'Aprovado.',
        reviewedAt,
        approvedUntil,
        requestId: 'request-1',
      }),
    ).resolves.toBe(true);
    expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'approval-1', status: 'PENDING', version: 1 },
      data: { status: 'APPROVED', version: { increment: 1 } },
    });
    expect(auditCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        actorUserId: 'reviewer-1',
        action: 'ORDER_PRICE_APPROVAL_APPROVED',
        requestId: 'request-1',
        metadata: {
          requesterId: 'user-1',
          reviewerId: 'reviewer-1',
          previousStatus: 'PENDING',
          status: 'APPROVED',
          itemCount: 2,
          exceptionCount: 1,
        },
      },
    });
  });

  it('expira de forma condicional e nao duplica auditoria em replay', async () => {
    const updateMany = vi
      .fn(async (_input: unknown) => ({ count: 0 }))
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const auditCreate = vi.fn(async (_input: unknown) => ({}));
    const candidate = {
      id: 'approval-1',
      version: 2,
      requestedByUserId: 'user-1',
      reviewedByUserId: 'reviewer-1',
      customerId: 'customer-1',
      contentHash: 'a'.repeat(64),
      hashVersion: 1,
      exceptionAmount: new Prisma.Decimal('80.0000'),
      items: [{ requiresApproval: true }],
    };
    const transaction = {
      orderPriceApprovalRequest: { updateMany },
      auditLog: { create: auditCreate },
    };
    const findMany = vi.fn().mockResolvedValue([candidate]);
    const prisma = {
      orderPriceApprovalRequest: { findMany },
      $transaction: (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    } as unknown as PrismaClient;
    const repository = new PrismaOrderPriceApprovalsRepository(prisma);
    const input = {
      now: new Date('2026-10-10T12:00:00.000Z'),
      requestId: 'request-expire',
    };

    await expect(repository.expireApproved(input)).resolves.toBe(1);
    await expect(repository.expireApproved(input)).resolves.toBe(0);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ approvedUntil: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    );
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        actorUserId: null,
        action: 'ORDER_PRICE_APPROVAL_EXPIRED',
        entityId: 'approval-1',
        requestId: 'request-expire',
      },
    });
  });
});
