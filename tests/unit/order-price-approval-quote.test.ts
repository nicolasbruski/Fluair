import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  approvalContentFromQuote,
  hashOrderPriceApprovalContent,
} from '../../src/server/modules/order-price-approvals/order-price-approval-content.js';
import type { OrdersRepository } from '../../src/server/modules/orders/orders.repository.js';
import { OrdersService } from '../../src/server/modules/orders/orders.service.js';
import type { AuthenticatedUser } from '../../src/shared/auth.js';

const customerId = '60000000-0000-4000-8000-000000000001';
const versionId = '20000000-0000-4000-8000-000000000001';

function fakePrisma(approval: unknown = null): PrismaClient {
  return {
    customer: {
      findFirst: async () => ({
        id: customerId,
        code: 'C-01',
        legalName: 'Cliente',
        cnpj: null,
        city: null,
        state: null,
        customerClass: null,
        customerSegment: {
          id: '70000000-0000-4000-8000-000000000001',
          code: 'IND',
          name: 'Indústria',
          active: true,
        },
      }),
    },
    priceListItem: {
      findMany: async () => [
        {
          productCode: 'P-01',
          description: 'Produto',
          reference: 'REF',
          unitPrice: new Prisma.Decimal('15'),
          ipiRate: new Prisma.Decimal('3.25'),
          ipiIncluded: true,
          icmsRate: new Prisma.Decimal('17.5'),
          priceListVersionId: versionId,
          priceListVersion: {
            id: versionId,
            version: 4,
            priceList: {
              id: '10000000-0000-4000-8000-000000000001',
              code: 'ATACADO',
              name: 'Atacado 2-9',
              minimumOrderQuantity: 2,
              maximumOrderQuantity: 9,
            },
          },
        },
      ],
    },
    calculationVersion: { findMany: async () => [] },
    product: {
      findMany: async () => [{ id: 'product-1', code: 'P-01', unit: 'UN', currentImage: null }],
    },
    orderPriceApprovalRequest: { findFirst: async () => approval },
  } as unknown as PrismaClient;
}

function actor(permissions: AuthenticatedUser['permissions']): AuthenticatedUser {
  return {
    id: 'user-1',
    name: 'Solicitante',
    email: 'solicitante@example.com',
    permissions,
  };
}

describe('cotacao de excecao comercial', () => {
  it('usa exatamente a lista/faixa selecionada e emite token curto para a nova revisao', async () => {
    const result = await new OrdersService(fakePrisma()).quote(
      {
        customerId,
        lines: [
          {
            kind: 'STANDALONE_PRODUCT',
            productCode: 'P-01',
            priceListVersionId: versionId,
            quantity: 2,
            negotiatedUnitPrice: '12.0000',
          },
        ],
      },
      actor(['order.access', 'price.view', 'price.override']),
    );

    expect(result.data.quoteToken.length).toBeGreaterThan(40);
    expect(result.data.approval).toEqual({
      required: true,
      violations: [
        expect.objectContaining({
          line: 1,
          priceListVersionId: versionId,
          minimumOrderQuantity: 2,
          maximumOrderQuantity: 9,
          minimumUnitPrice: '15.0000',
          negotiatedUnitPrice: '12.0000',
          unitDifference: '3.0000',
          totalDifference: '6.0000',
          differencePercentage: '20.0000',
        }),
      ],
    });
  });

  it('exige price.override para qualquer preco negociado divergente', async () => {
    await expect(
      new OrdersService(fakePrisma()).quote(
        {
          customerId,
          lines: [
            {
              kind: 'STANDALONE_PRODUCT',
              productCode: 'P-01',
              priceListVersionId: versionId,
              quantity: 2,
              negotiatedUnitPrice: '16.0000',
            },
          ],
        },
        actor(['order.access', 'price.view']),
      ),
    ).rejects.toMatchObject({ status: 403, code: 'ORDER_PRICE_OVERRIDE_FORBIDDEN' });
  });
});

describe('liberacao do pedido por aprovacao', () => {
  const command = {
    customerId,
    lines: [
      {
        kind: 'STANDALONE_PRODUCT' as const,
        productCode: 'P-01',
        priceListVersionId: versionId,
        quantity: 2,
        negotiatedUnitPrice: '12.0000',
      },
    ],
  };
  const requester = actor(['order.access', 'price.view', 'price.override']);
  const now = new Date('2026-10-01T12:00:00.000Z');

  function repository() {
    const findMock = vi.fn().mockResolvedValue(null);
    const createMock = vi.fn().mockResolvedValue({
      order: {
        id: 'order-1',
        number: 'PED-2026-000001',
        status: 'SUBMITTED',
        submittedAt: now.toISOString(),
      },
      emailDelivery: { id: 'delivery-1', status: 'PENDING', recipients: [] },
    });
    return {
      findByIdempotency: findMock,
      createWithFirstDelivery: createMock,
      findMock,
      createMock,
    } as unknown as OrdersRepository & {
      findMock: ReturnType<typeof vi.fn>;
      createMock: ReturnType<typeof vi.fn>;
    };
  }

  async function quoteAt(date: Date) {
    return new OrdersService(fakePrisma(), { clock: { now: () => date } }).quote(
      command,
      requester,
    );
  }

  async function approvedRow(overrides: Record<string, unknown> = {}) {
    const quote = await quoteAt(now);
    const resolved = approvalContentFromQuote(quote.data, requester.id);
    const hashed = hashOrderPriceApprovalContent(resolved.content);
    return {
      quote,
      approval: {
        id: '80000000-0000-4000-8000-000000000001',
        status: 'APPROVED',
        contentHash: hashed.hash,
        hashVersion: hashed.version,
        version: 2,
        reviewedAt: new Date('2026-10-01T11:59:00.000Z'),
        approvedUntil: new Date('2026-10-08T12:00:00.000Z'),
        consumedOrderId: null,
        ...overrides,
      },
    };
  }

  it('envia a aprovação exata ao repositório para consumo transacional', async () => {
    const { quote, approval } = await approvedRow();
    const ordersRepository = repository();
    const service = new OrdersService(fakePrisma(approval), {
      repository: ordersRepository,
      clock: { now: () => now },
    });

    await expect(
      service.create(
        {
          ...command,
          note: 'Observação livre',
          quoteToken: quote.data.quoteToken,
          approvalRequestId: approval.id,
        },
        'order:approval:0001',
        requester,
        'request-1',
      ),
    ).resolves.toMatchObject({ data: { replayed: false } });

    expect(ordersRepository.createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Observação livre',
        priceApproval: {
          id: approval.id,
          expectedVersion: 2,
          contentHash: approval.contentHash,
          hashVersion: approval.hashVersion,
        },
      }),
      { requestId: 'request-1' },
    );

    const persisted = ordersRepository.createMock.mock.calls[0]![0] as {
      contentHash: string;
    };
    ordersRepository.findMock.mockResolvedValue({
      contentHash: persisted.contentHash,
      snapshot: {
        order: {
          id: 'order-1',
          number: 'PED-2026-000001',
          status: 'SUBMITTED',
          submittedAt: now.toISOString(),
        },
        emailDelivery: { id: 'delivery-1', status: 'PENDING', recipients: [] },
      },
    });
    await expect(
      service.create(
        {
          ...command,
          note: 'Observação livre',
          quoteToken: quote.data.quoteToken,
          approvalRequestId: approval.id,
        },
        'order:approval:0001',
        requester,
        'request-replay',
      ),
    ).resolves.toMatchObject({ data: { replayed: true, order: { id: 'order-1' } } });
    expect(ordersRepository.createMock).toHaveBeenCalledTimes(1);
  });

  it('bloqueia ausência, conteúdo divergente e aprovação já consumida', async () => {
    const { quote, approval } = await approvedRow();
    const base = {
      ...command,
      note: '',
      quoteToken: quote.data.quoteToken,
    };
    await expect(
      new OrdersService(fakePrisma(), {
        repository: repository(),
        clock: { now: () => now },
      }).create(base, 'order:approval:missing', requester, 'request-2'),
    ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_REQUIRED' });

    await expect(
      new OrdersService(fakePrisma({ ...approval, contentHash: 'f'.repeat(64) }), {
        repository: repository(),
        clock: { now: () => now },
      }).create(
        { ...base, approvalRequestId: approval.id },
        'order:approval:mismatch',
        requester,
        'request-3',
      ),
    ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_CONTENT_MISMATCH' });

    await expect(
      new OrdersService(
        fakePrisma({ ...approval, status: 'CONSUMED', consumedOrderId: 'order-old' }),
        { repository: repository(), clock: { now: () => now } },
      ).create(
        { ...base, approvalRequestId: approval.id },
        'order:approval:consumed',
        requester,
        'request-4',
      ),
    ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_ALREADY_CONSUMED' });
  });

  it('exige token de cotação emitido depois da decisão', async () => {
    const oldQuote = await quoteAt(new Date('2026-10-01T11:58:00.000Z'));
    const { approval } = await approvedRow();
    const service = new OrdersService(fakePrisma(approval), {
      repository: repository(),
      clock: { now: () => now },
    });

    await expect(
      service.create(
        {
          ...command,
          note: '',
          quoteToken: oldQuote.data.quoteToken,
          approvalRequestId: approval.id,
        },
        'order:approval:stale',
        requester,
        'request-5',
      ),
    ).rejects.toMatchObject({ code: 'ORDER_QUOTE_STALE' });
  });

  it.each(['PENDING', 'REJECTED', 'CANCELLED', 'SUPERSEDED'])(
    'bloqueia aprovação no estado %s',
    async (status) => {
      const { quote, approval } = await approvedRow({
        status,
        reviewedAt: null,
        approvedUntil: null,
      });
      const service = new OrdersService(fakePrisma(approval), {
        repository: repository(),
        clock: { now: () => now },
      });

      await expect(
        service.create(
          {
            ...command,
            note: '',
            quoteToken: quote.data.quoteToken,
            approvalRequestId: approval.id,
          },
          `order:approval:${status.toLowerCase()}`,
          requester,
          'request-status',
        ),
      ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_NOT_APPROVED' });
    },
  );

  it('bloqueia aprovação expirada', async () => {
    const { quote, approval } = await approvedRow({
      approvedUntil: new Date('2026-10-01T11:59:59.999Z'),
    });
    const service = new OrdersService(fakePrisma(approval), {
      repository: repository(),
      clock: { now: () => now },
    });
    await expect(
      service.create(
        {
          ...command,
          note: '',
          quoteToken: quote.data.quoteToken,
          approvalRequestId: approval.id,
        },
        'order:approval:expired',
        requester,
        'request-expired',
      ),
    ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_EXPIRED' });
  });

  it('rejeita aprovação em carrinho sem exceção', async () => {
    const normalCommand = {
      ...command,
      lines: [{ ...command.lines[0]!, negotiatedUnitPrice: '15.0000' }],
    };
    const service = new OrdersService(fakePrisma(), {
      repository: repository(),
      clock: { now: () => now },
    });
    const quote = await service.quote(normalCommand, requester);
    await expect(
      service.create(
        {
          ...normalCommand,
          note: '',
          quoteToken: quote.data.quoteToken,
          approvalRequestId: '80000000-0000-4000-8000-000000000001',
        },
        'order:approval:not-required',
        requester,
        'request-6',
      ),
    ).rejects.toMatchObject({ code: 'ORDER_PRICE_APPROVAL_NOT_REQUIRED' });
  });
});
