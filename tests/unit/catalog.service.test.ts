import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { CatalogService } from '../../src/server/modules/catalog/catalog.service.js';

const image = {
  id: '90000000-0000-4000-8000-000000000001',
  width: 800,
  height: 600,
  createdAt: new Date('2026-09-23T12:00:00.000Z'),
};

function setup() {
  const priceListItem = {
    findMany: vi.fn().mockResolvedValue([
      {
        productCode: 'AV-001',
        priceListVersion: {
          priceList: { id: 'list-1', code: 'VAREJO', name: 'Varejo' },
        },
      },
      {
        productCode: 'AV-001',
        priceListVersion: {
          priceList: { id: 'list-2', code: 'ATACADO', name: 'Atacado' },
        },
      },
    ]),
  };
  const product = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 'product-1',
        code: 'AV-001',
        description: 'Produto ofertado',
        reference: 'REF-1',
        currentImage: image,
      },
      // Um componente existente em Product não é devolvido, pois não veio das ofertas ativas.
    ]),
  };
  const kit = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 'kit-1',
        code: 'KIT-001',
        description: 'Kit disponível',
        reference: 'REF-KIT-1',
        currentImage: null,
        calculationSeries: [
          {
            priceList: { id: 'list-3', code: 'IMPL', name: 'Implementador' },
            calculations: [
              {
                id: 'calc-1',
                catalogScope: 'STANDARD',
                catalogDescription: 'Kit catálogo',
              },
            ],
          },
        ],
      },
    ]),
  };
  const prisma = { priceListItem, product, kit } as unknown as PrismaClient;
  return { service: new CatalogService(prisma), priceListItem, product, kit };
}

describe('CatalogService', () => {
  it('deduplica ofertas por Product e não promove componente sem oferta ativa', async () => {
    const { service, priceListItem, product } = setup();
    const result = await service.list({ search: '', filter: 'ALL', page: 1, pageSize: 30 });

    expect(result.data.items.map((item) => item.code)).toEqual(['AV-001', 'KIT-001']);
    const standalone = result.data.items.find((item) => item.kind === 'PRODUCT');
    expect(standalone?.origins.map((origin) => origin.name)).toEqual(['Atacado', 'Varejo']);
    expect(standalone?.image).toMatchObject({ id: image.id });
    expect(result.data.items.find((item) => item.kind === 'KIT')?.reference).toBe('REF-KIT-1');
    const query = product.findMany.mock.calls[0]?.[0] as unknown as {
      where: { code: { in: string[] } };
    };
    expect(query.where.code.in).toEqual(['AV-001']);
    expect(JSON.stringify(query)).not.toContain('thumbnailData');
    expect(JSON.stringify(query)).not.toContain('displayData');
    expect(product.findMany).toHaveBeenCalledTimes(1);
    expect(priceListItem.findMany).toHaveBeenCalledTimes(1);
  });

  it('aplica filtro sem foto e pagina a lista unificada', async () => {
    const { service, product, kit } = setup();
    const result = await service.list({
      search: '',
      filter: 'WITHOUT_IMAGE',
      page: 2,
      pageSize: 1,
    });

    const productQuery = product.findMany.mock.calls[0]?.[0] as unknown as {
      where: { currentImageId: null };
    };
    const kitQuery = kit.findMany.mock.calls[0]?.[0] as unknown as {
      where: { currentImageId: null };
    };
    expect(productQuery.where.currentImageId).toBeNull();
    expect(kitQuery.where.currentImageId).toBeNull();
    expect(result.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    expect(result.data.items).toHaveLength(1);
  });

  it('consulta somente o tipo solicitado', async () => {
    const { service, priceListItem } = setup();
    const result = await service.list({ search: 'KIT', filter: 'KITS', page: 1, pageSize: 30 });

    expect(priceListItem.findMany).not.toHaveBeenCalled();
    expect(result.data.items.every((item) => item.kind === 'KIT')).toBe(true);
  });
});
