import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  approveAdminOrderPriceApproval,
  countAdminOrderPriceApprovals,
  createOrderPriceApproval,
  listAdminOrderPriceApprovals,
  listMyOrderPriceApprovals,
  rejectAdminOrderPriceApproval,
} from '../../src/web/services/order-price-approvals-api.js';

describe('API web de aprovações de preço', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia a chave idempotente e o conteúdo da solicitação', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { approval: {}, violations: [], replayed: false } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const input = {
      customerId: '00000000-0000-4000-8000-000000000001',
      lines: [
        {
          kind: 'STANDALONE_PRODUCT' as const,
          productCode: 'P-1',
          priceListVersionId: '00000000-0000-4000-8000-000000000002',
          quantity: 2,
          negotiatedUnitPrice: '9.0000',
        },
      ],
      justification: 'Condição comercial negociada.',
    };
    await createOrderPriceApproval(input, 'approval:attempt-1');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [path, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/v1/order-price-approvals');
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).get('Idempotency-Key')).toBe('approval:attempt-1');
    expect(typeof options.body).toBe('string');
    expect(JSON.parse(options.body as string)).toEqual(input);
  });

  it('monta a consulta paginada das próprias solicitações com filtro de estado', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], pagination: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listMyOrderPriceApprovals({ status: 'APPROVED', page: 2, pageSize: 10 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/order-price-approvals/mine?page=2&pageSize=10&status=APPROVED',
    );
  });

  it('monta filtros e decisões da fila administrativa', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], pagination: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await countAdminOrderPriceApprovals();
    await listAdminOrderPriceApprovals({
      status: 'PENDING',
      requestedFrom: '2026-09-01T03:00:00.000Z',
      requestedTo: '2026-10-02T02:59:59.999Z',
      code: '703100',
      page: 2,
      pageSize: 20,
    });
    await approveAdminOrderPriceApproval(
      '00000000-0000-4000-8000-000000000001',
      3,
      '  Condição validada.  ',
    );
    await rejectAdminOrderPriceApproval(
      '00000000-0000-4000-8000-000000000001',
      4,
      '  Margem insuficiente.  ',
    );

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/order-price-approvals/admin/count');
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/v1/order-price-approvals/admin?page=2&pageSize=20&status=PENDING&requestedFrom=2026-09-01T03%3A00%3A00.000Z&requestedTo=2026-10-02T02%3A59%3A59.999Z&code=703100',
    );
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      expectedVersion: 3,
      note: 'Condição validada.',
    });
    expect(JSON.parse(fetchMock.mock.calls[3]?.[1]?.body as string)).toEqual({
      expectedVersion: 4,
      reason: 'Margem insuficiente.',
    });
  });
});
