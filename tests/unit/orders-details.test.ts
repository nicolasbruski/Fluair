import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { OrdersService } from '../../src/server/modules/orders/orders.service.js';
import type { OrdersRepository } from '../../src/server/modules/orders/orders.repository.js';
import { ROLE_CODES, type AuthenticatedUser } from '../../src/shared/auth.js';
import type { OrderDetailsEnvelope } from '../../src/shared/orders.js';

const creator: AuthenticatedUser = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Criador',
  email: 'criador@fluair.test',
  permissions: ['order.access', 'price.view'],
};

function details(): OrderDetailsEnvelope['data'] {
  return {
    order: {
      id: '20000000-0000-4000-8000-000000000001',
      number: 'PED-2026-000001',
      status: 'SUBMITTED',
      submittedAt: '2026-09-30T12:00:00.000Z',
      customer: {
        id: '30000000-0000-4000-8000-000000000001',
        code: 'CLI-001',
        legalName: 'Cliente',
        taxId: null,
        city: null,
        state: null,
        customerClass: null,
        customerSegment: null,
      },
      creator: { id: creator.id, name: creator.name, email: creator.email },
      note: null,
      totalQuantity: '1.0000',
      totalAmount: '10.0000',
      items: [],
    },
    emailDeliveries: [],
    priceApproval: null,
  };
}

function service(result: OrderDetailsEnvelope['data'] | null): OrdersService {
  const repository = {
    findDetails: vi.fn().mockResolvedValue(result),
  } as unknown as OrdersRepository;
  return new OrdersService({} as PrismaClient, { repository });
}

describe('consulta autorizada de pedido', () => {
  it('permite ao criador consultar o snapshot e o estado real das entregas', async () => {
    await expect(service(details()).details(details().order.id, creator)).resolves.toEqual({
      data: details(),
    });
  });

  it('permite ao administrador consultar pedido de outro usuario', async () => {
    const administrator: AuthenticatedUser = {
      ...creator,
      id: '40000000-0000-4000-8000-000000000001',
      roleCode: ROLE_CODES.administrator,
    };
    await expect(service(details()).details(details().order.id, administrator)).resolves.toEqual({
      data: details(),
    });
  });

  it('oculta a existencia do pedido de outro usuario', async () => {
    const other = { ...creator, id: '50000000-0000-4000-8000-000000000001' };
    await expect(service(details()).details(details().order.id, other)).rejects.toMatchObject({
      status: 404,
      code: 'ORDER_NOT_FOUND',
    });
  });
});
