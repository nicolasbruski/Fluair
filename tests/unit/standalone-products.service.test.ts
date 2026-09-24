import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import type { AppError } from '../../src/server/errors/app-error.js';
import { StandaloneProductsService } from '../../src/server/modules/price-lists/standalone-products.service.js';

const listId = '60000000-0000-4000-8000-000000000001';
const versionId = '70000000-0000-4000-8000-000000000001';

function list(overrides: Record<string, unknown> = {}) {
  return {
    id: listId,
    code: 'STANDALONE',
    name: 'Produtos avulsos',
    type: 'STANDALONE_PRODUCT',
    active: true,
    activeVersion: { id: versionId, version: 4 },
    ...overrides,
  };
}

function item(code = 'PRD-01') {
  return {
    productCode: code,
    description: 'Produto kit sem estrutura',
    reference: 'REF-01',
    unitPrice: new Prisma.Decimal('1234.5678'),
    ipiRate: new Prisma.Decimal('3.2500'),
    ipiIncluded: true,
    icmsRate: new Prisma.Decimal('12.0000'),
    sourceRow: 2,
  };
}

function expectCode(operation: Promise<unknown>, code: string): Promise<void> {
  return expect(operation).rejects.toMatchObject({ code } satisfies Partial<AppError>);
}

describe('catálogo e preço de produto sem estrutura', () => {
  it('busca somente na versão ativa por código, descrição e referência com paginação', async () => {
    let capturedFind: unknown;
    const findMany = vi.fn((input: unknown) => {
      capturedFind = input;
      return Promise.resolve([item()]);
    });
    const prisma = {
      priceList: { findUnique: vi.fn().mockResolvedValue(list()) },
      priceListItem: {
        count: vi.fn().mockResolvedValue(3),
        findMany,
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 'product-1', code: 'PRD-01' }]),
      },
    } as unknown as PrismaClient;

    const result = await new StandaloneProductsService(prisma).list(listId, {
      search: 'ref',
      page: 2,
      pageSize: 1,
    });

    expect(capturedFind).toMatchObject({
      where: {
        priceListVersionId: versionId,
        OR: [
          { productCode: { contains: 'ref' } },
          { description: { contains: 'ref' } },
          { reference: { contains: 'ref' } },
        ],
      },
      skip: 1,
      take: 1,
    });
    expect(result).toMatchObject({
      data: {
        version: { id: versionId, version: 4 },
        products: [
          {
            productId: 'product-1',
            code: 'PRD-01',
            description: 'Produto kit sem estrutura',
            reference: 'REF-01',
            unitPrice: '1234.5678',
            ipiRate: '3.25',
            ipiIncluded: true,
            icmsRate: '12',
          },
        ],
      },
      pagination: { page: 2, pageSize: 1, total: 3, totalPages: 3 },
    });
  });

  it('resolve o preço decimal sem somar o IPI e identifica a versão usada', async () => {
    const prisma = {
      priceList: { findUnique: vi.fn().mockResolvedValue(list()) },
      priceListItem: { findUnique: vi.fn().mockResolvedValue(item()) },
      product: { findUnique: vi.fn().mockResolvedValue({ id: 'product-1' }) },
    } as unknown as PrismaClient;
    const service = new StandaloneProductsService(prisma);

    const resolved = await service.resolveStandalonePrice(listId, 'PRD-01', versionId);
    expect(resolved).toMatchObject({
      priceListVersionId: versionId,
      productCode: 'PRD-01',
      reference: 'REF-01',
      ipiIncluded: true,
      icmsRate: new Prisma.Decimal('12'),
      sourceRow: 2,
    });
    expect(resolved.unitPrice.toString()).toBe('1234.5678');
    expect(resolved.ipiRate.toString()).toBe('3.25');
    expect(resolved.icmsRate.toString()).toBe('12');

    const response = await service.price(listId, 'PRD-01');
    expect(response.data.product).toEqual(
      expect.objectContaining({
        unitPrice: '1234.5678',
        ipiRate: '3.25',
        ipiIncluded: true,
        icmsRate: '12',
      }),
    );
    expect(response.data.product).not.toHaveProperty('priceWithIpi');
  });

  it('rejeita item ausente, lista incorreta, lista sem versão e versão alterada', async () => {
    function prismaWith(activeList: unknown, activeItem: unknown = null): PrismaClient {
      return {
        priceList: { findUnique: vi.fn().mockResolvedValue(activeList) },
        priceListItem: { findUnique: vi.fn().mockResolvedValue(activeItem) },
      } as unknown as PrismaClient;
    }

    await expectCode(
      new StandaloneProductsService(prismaWith(list())).resolveStandalonePrice(listId, 'AUSENTE'),
      'STANDALONE_PRODUCT_NOT_FOUND',
    );
    await expectCode(
      new StandaloneProductsService(
        prismaWith(list({ type: 'KIT_COMPONENT' })),
      ).resolveStandalonePrice(listId, 'PRD-01'),
      'PRICE_LIST_TYPE_MISMATCH',
    );
    await expectCode(
      new StandaloneProductsService(
        prismaWith(list({ activeVersion: null })),
      ).resolveStandalonePrice(listId, 'PRD-01'),
      'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
    );
    await expectCode(
      new StandaloneProductsService(prismaWith(list())).resolveStandalonePrice(
        listId,
        'PRD-01',
        '70000000-0000-4000-8000-000000000009',
      ),
      'ACTIVE_PRICE_LIST_VERSION_CHANGED',
    );
  });
});
