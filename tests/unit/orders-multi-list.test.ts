/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Prisma, type PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { OrdersService } from '../../src/server/modules/orders/orders.service.js';

describe('catálogo de pedidos com várias listas', () => {
  it('consolida o mesmo avulso na faixa das listas e exibe apenas kits padrão sem cliente', async () => {
    const lists = [
      {
        id: '10000000-0000-4000-8000-000000000001',
        code: 'LISTA_A',
        name: 'Lista A',
        minimumOrderQuantity: 50,
        maximumOrderQuantity: 99,
        activeVersion: { id: '20000000-0000-4000-8000-000000000001', version: 1 },
      },
      {
        id: '10000000-0000-4000-8000-000000000002',
        code: 'LISTA_B',
        name: 'Lista B',
        minimumOrderQuantity: 100,
        maximumOrderQuantity: null,
        activeVersion: { id: '20000000-0000-4000-8000-000000000002', version: 2 },
      },
    ];
    const products = lists.map((list, index) => ({
      productCode: 'P-01',
      description: 'Produto repetido',
      reference: 'REF',
      unitPrice: new Prisma.Decimal(index ? '12' : '10'),
      ipiRate: new Prisma.Decimal('3.25'),
      ipiIncluded: true,
      icmsRate: new Prisma.Decimal(index ? '18' : '12'),
      priceListVersionId: list.activeVersion.id,
      priceListVersion: { version: list.activeVersion.version },
    }));
    const prisma = {
      priceList: { findMany: vi.fn().mockResolvedValue(lists) },
      priceListItem: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue(products),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'p1',
            code: 'P-01',
            currentImage: {
              id: 'image-product-current',
              width: 800,
              height: 600,
              createdAt: new Date('2026-09-20T12:00:00Z'),
            },
          },
        ]),
      },
      calculationVersion: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: '30000000-0000-4000-8000-000000000001',
            version: 1,
            createdAt: new Date('2026-09-17T12:00:00Z'),
            kitDescription: 'Kit padrão',
            minimumTotal: new Prisma.Decimal('100'),
            normalTotal: new Prisma.Decimal('120'),
            catalogDescription: null,
            catalogMinimumPrice: null,
            catalogNormalPrice: null,
            catalogScope: 'STANDARD',
            series: {
              kit: {
                code: 'K-01',
                currentImage: {
                  id: 'image-kit-current',
                  width: 900,
                  height: 700,
                  createdAt: new Date('2026-09-21T12:00:00Z'),
                },
              },
              priceList: {
                id: '40000000-0000-4000-8000-000000000001',
                code: 'COMP',
                name: 'Componentes',
                type: 'KIT_COMPONENT',
              },
            },
            priceListVersion: { id: '50000000-0000-4000-8000-000000000001', version: 1 },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).catalog({
      quantities: [],
      search: '',
      page: 1,
      pageSize: 20,
    });

    expect(result.data.customer).toBeNull();
    expect(result.data.products).toHaveLength(1);
    expect(
      result.data.products.map((item) => [item.code, item.priceList.code, item.unitPrice]),
    ).toEqual([['P-01', 'LISTA_B', '12']]);
    expect(result.data.products[0]).toMatchObject({
      minimumPrice: '10',
      maximumPrice: '12',
      priceRanges: [
        expect.objectContaining({
          priceList: { id: lists[0]!.id, code: 'LISTA_A', name: 'Lista A' },
          minimumOrderQuantity: 50,
          maximumOrderQuantity: 99,
          minimumPrice: '10',
          maximumPrice: '10',
          ipiRate: '3.25',
          icmsRate: '12',
        }),
        expect.objectContaining({
          priceList: { id: lists[1]!.id, code: 'LISTA_B', name: 'Lista B' },
          minimumOrderQuantity: 100,
          maximumOrderQuantity: null,
          minimumPrice: '10',
          maximumPrice: '12',
          ipiRate: '3.25',
          icmsRate: '18',
        }),
      ],
    });
    expect(result.pagination).toMatchObject({ productTotal: 1, productTotalPages: 1 });
    expect(result.data.products[0]?.image?.id).toBe('image-product-current');
    expect(result.data.kits[0]).toMatchObject({
      code: 'K-01',
      scope: 'STANDARD',
      image: { id: 'image-kit-current' },
    });
    expect(JSON.stringify(result)).not.toContain('thumbnailData');
    expect(prisma.priceListItem.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.calculationVersion.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.calculationVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ catalogScope: 'STANDARD' })]),
        }),
      }),
    );
  });

  it('filtra avulsos pelo segmento e combina kit padrão com kit do cliente', async () => {
    const customerId = '60000000-0000-4000-8000-000000000001';
    const segmentId = '70000000-0000-4000-8000-000000000001';
    const classId = '80000000-0000-4000-8000-000000000001';
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente',
          customerClass: { id: classId, active: true },
          customerSegment: { id: segmentId, active: true },
        }),
      },
      priceList: { findMany: vi.fn().mockResolvedValue([]) },
      priceListItem: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      calculationVersion: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;

    await new OrdersService(prisma).catalog({
      customerId,
      quantities: [],
      search: '',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.priceList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          segments: { some: { customerSegmentId: segmentId } },
        }),
      }),
    );
    expect(prisma.calculationVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [
                { catalogScope: 'STANDARD' },
                {
                  catalogScope: 'CUSTOMER_SPECIFIC',
                  customers: { some: { customerId } },
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });

  it('mantém os avulsos do segmento quando o cliente não possui classe', async () => {
    const customerId = '60000000-0000-4000-8000-000000000001';
    const segmentId = '70000000-0000-4000-8000-000000000001';
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente sem classe',
          customerClass: null,
          customerSegment: { id: segmentId, active: true },
        }),
      },
      priceList: { findMany: vi.fn().mockResolvedValue([]) },
      priceListItem: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      calculationVersion: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).catalog({
      customerId,
      quantities: [],
      search: '',
      page: 1,
      pageSize: 20,
    });

    expect(result.data.customer?.id).toBe(customerId);
    expect(prisma.priceList.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          segments: { some: { customerSegmentId: segmentId } },
        }),
      }),
    );
    expect(prisma.calculationVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ id: { in: [] } }]),
        }),
      }),
    );
  });

  it('cota o avulso pela versão exata da lista informada na linha', async () => {
    const customerId = '60000000-0000-4000-8000-000000000001';
    const versionId = '20000000-0000-4000-8000-000000000001';
    const product = {
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
          code: 'SEGMENTO_A',
          name: 'Lista do segmento',
          minimumOrderQuantity: null,
          maximumOrderQuantity: null,
        },
      },
    };
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente',
          customerClass: { id: '80000000-0000-4000-8000-000000000001', active: true },
          customerSegment: { id: '70000000-0000-4000-8000-000000000001', active: true },
        }),
      },
      priceListItem: { findMany: vi.fn().mockResolvedValue([product]) },
      calculationVersion: { findMany: vi.fn().mockResolvedValue([]) },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            code: 'P-01',
            currentImage: {
              id: 'image-product-quote',
              width: 800,
              height: 600,
              createdAt: new Date('2026-09-22T12:00:00Z'),
            },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).quote({
      customerId,
      lines: [
        {
          kind: 'STANDALONE_PRODUCT',
          productCode: 'P-01',
          priceListVersionId: versionId,
          quantity: 2,
        },
      ],
    });

    expect(result.data.total).toBe('30.0000');
    expect(result.data.lines[0]).toMatchObject({
      kind: 'STANDALONE_PRODUCT',
      productCode: 'P-01',
      unitPrice: '15.0000',
      priceList: { code: 'SEGMENTO_A' },
      priceListVersion: { id: versionId, version: 4 },
      icmsRate: '17.5000',
      image: { id: 'image-product-quote' },
    });
    expect(prisma.priceListItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ priceListVersionId: versionId, productCode: 'P-01' }],
        }),
      }),
    );
  });

  it('cota produto avulso pelo segmento sem exigir classe do cliente', async () => {
    const customerId = '60000000-0000-4000-8000-000000000001';
    const segmentId = '70000000-0000-4000-8000-000000000001';
    const versionId = '20000000-0000-4000-8000-000000000001';
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente sem classe',
          customerClass: null,
          customerSegment: { id: segmentId, active: true },
        }),
      },
      priceListItem: {
        findMany: vi.fn().mockResolvedValue([
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
              version: 1,
              priceList: {
                id: '10000000-0000-4000-8000-000000000001',
                code: 'SEGMENTO_A',
                name: 'Lista do segmento',
                minimumOrderQuantity: null,
                maximumOrderQuantity: null,
              },
            },
          },
        ]),
      },
      calculationVersion: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).quote({
      customerId,
      lines: [
        {
          kind: 'STANDALONE_PRODUCT',
          productCode: 'P-01',
          priceListVersionId: versionId,
          quantity: 1,
        },
      ],
    });

    expect(result.data.customer).toMatchObject({
      customerClassId: null,
      customerSegmentId: segmentId,
    });
    expect(result.data.lines[0]).toMatchObject({
      kind: 'STANDALONE_PRODUCT',
      productCode: 'P-01',
    });
  });

  it('reafirma na cotação a imagem atual do kit em uma consulta em lote', async () => {
    const customerId = '60000000-0000-4000-8000-000000000001';
    const calculationId = '30000000-0000-4000-8000-000000000001';
    const currentImage = {
      id: 'image-kit-quote-current',
      width: 1200,
      height: 900,
      createdAt: new Date('2026-09-22T12:00:00Z'),
    };
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: customerId,
          code: 'C-01',
          legalName: 'Cliente',
          customerClass: { id: 'class-1', active: true },
          customerSegment: null,
        }),
      },
      priceListItem: { findMany: vi.fn().mockResolvedValue([]) },
      product: { findMany: vi.fn().mockResolvedValue([]) },
      calculationVersion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: calculationId,
            version: 4,
            kitDescription: 'Kit cotado',
            minimumTotal: new Prisma.Decimal('100'),
            normalTotal: new Prisma.Decimal('120'),
            catalogDescription: null,
            catalogMinimumPrice: null,
            catalogNormalPrice: null,
            catalogScope: 'STANDARD',
            series: {
              kit: { code: 'K-01', currentImage },
              priceList: { id: 'list-1', code: 'KIT', name: 'Kits', type: 'KIT_COMPONENT' },
            },
            priceListVersion: { id: 'version-1', version: 7 },
          },
        ]),
      },
    } as unknown as PrismaClient;

    const result = await new OrdersService(prisma).quote({
      customerId,
      lines: [{ kind: 'KIT', calculationId, priceReference: 'NORMAL', quantity: 1 }],
    });

    expect(result.data.lines[0]).toMatchObject({
      kind: 'KIT',
      code: 'K-01',
      unitPrice: '120.0000',
      image: { id: currentImage.id },
    });
    expect(prisma.calculationVersion.findMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toMatch(/base64|thumbnailData|displayData/i);
  });
});
