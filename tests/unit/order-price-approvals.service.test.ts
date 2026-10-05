import { describe, expect, it, vi } from 'vitest';

import type { OrderPriceApprovalsRepository } from '../../src/server/modules/order-price-approvals/order-price-approvals.repository.js';
import type { OrderPriceApprovalRepositoryContext } from '../../src/server/modules/order-price-approvals/order-price-approvals.repository.js';
import { OrderPriceApprovalsService } from '../../src/server/modules/order-price-approvals/order-price-approvals.service.js';
import type { OrdersService } from '../../src/server/modules/orders/orders.service.js';
import type { AuthenticatedUser } from '../../src/shared/auth.js';
import type {
  CreateOrderPriceApprovalSnapshot,
  OrderPriceApprovalDetail,
} from '../../src/shared/order-price-approvals.js';

const actor: AuthenticatedUser = {
  id: 'user-1',
  name: 'Solicitante',
  email: 'SOLICITANTE@example.com',
  permissions: ['order.access', 'price.view', 'price.override'],
};

const reviewer: AuthenticatedUser = {
  id: 'reviewer-1',
  name: 'Revisora',
  email: 'REVISORA@example.com',
  permissions: ['order.price-approval.manage'],
};

function quote(required = true) {
  return {
    data: {
      customer: {
        id: 'customer-1',
        code: 'C-01',
        legalName: 'Cliente',
        customerClassId: null,
        customerSegmentId: 'segment-1',
        customerClass: null,
        customerSegment: { id: 'segment-1', code: 'IND', name: 'Industria' },
      },
      totalQuantity: 3,
      lines: [
        {
          kind: 'STANDALONE_PRODUCT' as const,
          productId: 'product-1',
          productCode: 'P-01',
          priceList: {
            id: 'list-1',
            code: 'ATACADO',
            name: 'Atacado 2-9',
            minimumOrderQuantity: 2,
            maximumOrderQuantity: 9,
          },
          description: 'Produto',
          reference: 'REF',
          unit: 'UN',
          quantity: 3,
          unitPrice: required ? '8.0000' : '10.0000',
          referenceUnitPrice: '10.0000',
          negotiatedUnitPrice: required ? '8.0000' : '10.0000',
          minimumReferencePrice: '10.0000',
          normalReferencePrice: '10.0000',
          subtotal: required ? '24.0000' : '30.0000',
          ipiRate: '2.0000',
          ipiIncluded: true as const,
          icmsRate: '18.0000',
          priceListVersion: { id: 'version-1', version: 4 },
          image: null,
        },
      ],
      total: required ? '24.0000' : '30.0000',
      referenceTotal: '30.0000',
      creator: actor,
      recipients: [],
      quoteToken: '',
      expiresAt: '2026-10-01T00:10:00.000Z',
      approval: {
        required,
        violations: required
          ? [
              {
                line: 1,
                kind: 'STANDALONE_PRODUCT' as const,
                code: 'P-01',
                priceListVersionId: 'version-1',
                priceListName: 'Atacado 2-9',
                minimumOrderQuantity: 2,
                maximumOrderQuantity: 9,
                quantity: '3.0000',
                minimumUnitPrice: '10.0000',
                negotiatedUnitPrice: '8.0000',
                unitDifference: '2.0000',
                totalDifference: '6.0000',
                differencePercentage: '20.0000',
              },
            ]
          : [],
      },
      differences: [],
      warnings: [],
      quotedAt: '2026-10-01T00:00:00.000Z',
    },
  };
}

function ownedApproval(): OrderPriceApprovalDetail {
  return {
    id: 'approval-1',
    status: 'PENDING',
    requester: { id: actor.id, name: actor.name, email: actor.email },
    customer: {
      id: 'customer-1',
      code: 'C-01',
      legalName: 'Cliente',
      customerClass: null,
      customerSegment: null,
    },
    justification: 'Condicao comercial especial.',
    requestedAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    totalQuantity: '1.0000',
    minimumTotalAmount: '10.0000',
    requestedTotalAmount: '8.0000',
    exceptionAmount: '2.0000',
    itemCount: 1,
    exceptionCount: 1,
    decision: null,
    consumedOrder: null,
    consumedAt: null,
    version: 1,
    items: [],
  };
}

describe('OrderPriceApprovalsService', () => {
  it('recalcula o snapshot a partir da cotacao autoritativa e persiste o carrinho completo', async () => {
    const create = vi.fn(
      async (
        input: CreateOrderPriceApprovalSnapshot,
        _context: OrderPriceApprovalRepositoryContext,
      ) => ({
        approval: {
          id: 'approval-1',
          status: 'PENDING' as const,
          requester: input.requester,
          customer: input.customer,
          justification: input.justification,
          requestedAt: '2026-10-01T00:00:00.000Z',
          updatedAt: '2026-10-01T00:00:00.000Z',
          totalQuantity: input.totalQuantity,
          minimumTotalAmount: input.minimumTotalAmount,
          requestedTotalAmount: input.requestedTotalAmount,
          exceptionAmount: input.exceptionAmount,
          itemCount: input.items.length,
          exceptionCount: 1,
          decision: null,
          consumedOrder: null,
          consumedAt: null,
          version: 1,
          items: input.items,
        },
        replayed: false,
      }),
    );
    const repository = { create } as unknown as OrderPriceApprovalsRepository;
    const orders = { quote: vi.fn().mockResolvedValue(quote()) } as unknown as OrdersService;
    const service = new OrderPriceApprovalsService(repository, orders);

    const result = await service.create(
      {
        customerId: 'customer-1',
        lines: [
          {
            kind: 'STANDALONE_PRODUCT',
            productCode: 'P-01',
            priceListVersionId: 'version-1',
            quantity: 3,
            negotiatedUnitPrice: '0.0001',
          },
        ],
        justification: 'Condicao comercial especial.',
      },
      'approval:1234567890abcdef',
      actor,
      'request-1',
    );

    const persisted = create.mock.calls[0]?.[0];
    expect(persisted?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted).toMatchObject({
      totalQuantity: '3.0000',
      minimumTotalAmount: '30.0000',
      requestedTotalAmount: '24.0000',
      exceptionAmount: '6.0000',
      requester: { email: 'solicitante@example.com' },
      items: [
        {
          minimumUnitPrice: '10.0000',
          negotiatedUnitPrice: '8.0000',
          minimumSubtotal: '30.0000',
          negotiatedSubtotal: '24.0000',
        },
      ],
    });
    expect(create.mock.calls[0]?.[1]).toEqual({ requestId: 'request-1' });
    expect(result.data.approval).not.toHaveProperty('items');
    expect(result.data.violations).toHaveLength(1);
  });

  it('nao cria solicitacao quando o recálculo nao encontra mais excecao', async () => {
    const create = vi.fn();
    const repository = { create } as unknown as OrderPriceApprovalsRepository;
    const orders = {
      quote: vi.fn().mockResolvedValue(quote(false)),
    } as unknown as OrdersService;
    const service = new OrderPriceApprovalsService(repository, orders);

    await expect(
      service.create(
        {
          customerId: 'customer-1',
          lines: [
            {
              kind: 'STANDALONE_PRODUCT',
              productCode: 'P-01',
              priceListVersionId: 'version-1',
              quantity: 3,
              negotiatedUnitPrice: '10.0000',
            },
          ],
          justification: 'Condicao comercial especial.',
        },
        'approval:1234567890abcdef',
        actor,
        'request-1',
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: 'ORDER_PRICE_APPROVAL_NOT_REQUIRED',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('nao sobrescreve uma decisao concorrente durante o cancelamento', async () => {
    const cancelOwned = vi.fn().mockResolvedValue(false);
    const repository = {
      findOwnedById: vi.fn().mockResolvedValue(ownedApproval()),
      cancelOwned,
    } as unknown as OrderPriceApprovalsRepository;
    const service = new OrderPriceApprovalsService(repository);

    await expect(
      service.cancel('approval-1', { expectedVersion: 1 }, actor, 'request-1'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_PRICE_APPROVAL_NOT_PENDING',
    });
    expect(cancelOwned).toHaveBeenCalledWith({
      id: 'approval-1',
      requesterId: actor.id,
      expectedVersion: 1,
      requestId: 'request-1',
    });
  });

  it('aprova com validade calculada pelo relogio injetado e snapshot do revisor', async () => {
    const pending = ownedApproval();
    const approved = {
      ...pending,
      status: 'APPROVED' as const,
      version: 2,
      decision: {
        reviewer: { id: reviewer.id, name: reviewer.name, email: 'revisora@example.com' },
        note: 'Aprovado para o cliente.',
        reviewedAt: '2026-10-01T12:00:00.000Z',
        approvedUntil: '2026-10-08T12:00:00.000Z',
      },
    };
    const decide = vi.fn().mockResolvedValue(true);
    const repository = {
      findById: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(approved),
      decide,
    } as unknown as OrderPriceApprovalsRepository;
    const service = new OrderPriceApprovalsService(repository, undefined, {
      clock: { now: () => new Date('2026-10-01T12:00:00.000Z') },
      approvalValidityDays: 7,
    });

    const result = await service.approve(
      pending.id,
      { expectedVersion: 1, note: 'Aprovado para o cliente.' },
      reviewer,
      'request-approve',
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        id: pending.id,
        status: 'APPROVED',
        reviewer: { id: reviewer.id, name: reviewer.name, email: 'revisora@example.com' },
        approvedUntil: new Date('2026-10-08T12:00:00.000Z'),
        requestId: 'request-approve',
      }),
    );
    expect(result.data.status).toBe('APPROVED');
  });

  it('bloqueia autoaprovacao e autorreprovacao antes de persistir', async () => {
    const decide = vi.fn();
    const repository = {
      findById: vi.fn().mockResolvedValue(ownedApproval()),
      decide,
    } as unknown as OrderPriceApprovalsRepository;
    const service = new OrderPriceApprovalsService(repository);

    await expect(
      service.approve('approval-1', { expectedVersion: 1 }, actor, 'request-approve'),
    ).rejects.toMatchObject({ status: 403, code: 'ORDER_PRICE_APPROVAL_SELF_REVIEW' });
    await expect(
      service.reject(
        'approval-1',
        { expectedVersion: 1, reason: 'Margem insuficiente.' },
        actor,
        'request-reject',
      ),
    ).rejects.toMatchObject({ status: 403, code: 'ORDER_PRICE_APPROVAL_SELF_REVIEW' });
    expect(decide).not.toHaveBeenCalled();
  });

  it('devolve o estado atual quando perde uma corrida de decisao', async () => {
    const pending = ownedApproval();
    const rejected = { ...pending, status: 'REJECTED' as const, version: 2 };
    const repository = {
      findById: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(rejected),
      decide: vi.fn().mockResolvedValue(false),
    } as unknown as OrderPriceApprovalsRepository;
    const service = new OrderPriceApprovalsService(repository);

    await expect(
      service.approve('approval-1', { expectedVersion: 1 }, reviewer, 'request-approve'),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ORDER_PRICE_APPROVAL_CONCURRENT_DECISION',
      fieldErrors: { currentStatus: ['REJECTED'], currentVersion: ['2'] },
    });
  });

  it('expira oportunisticamente antes de devolver detalhes', async () => {
    const expired = { ...ownedApproval(), status: 'EXPIRED' as const, version: 3 };
    const expireApproved = vi.fn().mockResolvedValue(1);
    const repository = {
      expireApproved,
      findOwnedById: vi.fn().mockResolvedValue(expired),
    } as unknown as OrderPriceApprovalsRepository;
    const service = new OrderPriceApprovalsService(repository, undefined, {
      clock: { now: () => new Date('2026-10-10T12:00:00.000Z') },
    });

    const result = await service.ownDetails(expired.id, actor, 'request-read');

    expect(expireApproved).toHaveBeenCalledWith({
      id: expired.id,
      requesterId: actor.id,
      now: new Date('2026-10-10T12:00:00.000Z'),
      requestId: 'request-read',
    });
    expect(result.data.status).toBe('EXPIRED');
  });
});
