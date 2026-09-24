import type { PrismaClient } from '@prisma/client';

import type { CatalogEnvelope, CatalogItem, CatalogOrigin } from '../../../shared/catalog.js';
import { imageReference } from '../../../shared/media.js';
import type { CatalogQuery } from './catalog.schemas.js';

const imageSelect = { id: true, width: true, height: true, createdAt: true } as const;

function uniqueOrigins(origins: CatalogOrigin[]): CatalogOrigin[] {
  return [...new Map(origins.map((origin) => [origin.id, origin])).values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
}

export class CatalogService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: CatalogQuery): Promise<CatalogEnvelope> {
    const includeKits =
      query.filter === 'ALL' || query.filter === 'KITS' || query.filter === 'WITHOUT_IMAGE';
    const includeProducts =
      query.filter === 'ALL' || query.filter === 'PRODUCTS' || query.filter === 'WITHOUT_IMAGE';
    const search = query.search.trim();

    const [offers, kits] = await Promise.all([
      includeProducts
        ? this.prisma.priceListItem.findMany({
            where: {
              priceListVersion: {
                activeForLists: { some: { active: true, type: 'STANDALONE_PRODUCT' } },
              },
            },
            orderBy: [{ productCode: 'asc' }, { priceListVersion: { createdAt: 'desc' } }],
            select: {
              productCode: true,
              priceListVersion: {
                select: {
                  priceList: { select: { id: true, code: true, name: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      includeKits
        ? this.prisma.kit.findMany({
            where: {
              ...(query.filter === 'WITHOUT_IMAGE' ? { currentImageId: null } : {}),
              ...(search
                ? {
                    OR: [
                      { code: { contains: search } },
                      { description: { contains: search } },
                      { reference: { contains: search } },
                      {
                        calculationSeries: {
                          some: {
                            calculations: {
                              some: {
                                current: true,
                                catalogVisible: true,
                                catalogDescription: { contains: search },
                              },
                            },
                          },
                        },
                      },
                    ],
                  }
                : {}),
              calculationSeries: {
                some: {
                  priceList: { active: true, type: 'KIT_COMPONENT' },
                  calculations: { some: { current: true, catalogVisible: true } },
                },
              },
            },
            orderBy: { code: 'asc' },
            select: {
              id: true,
              code: true,
              description: true,
              reference: true,
              currentImage: { select: imageSelect },
              calculationSeries: {
                where: {
                  priceList: { active: true, type: 'KIT_COMPONENT' },
                  calculations: { some: { current: true, catalogVisible: true } },
                },
                orderBy: { priceList: { name: 'asc' } },
                select: {
                  priceList: { select: { id: true, code: true, name: true } },
                  calculations: {
                    where: { current: true, catalogVisible: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { id: true, catalogScope: true, catalogDescription: true },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const offerOrigins = new Map<string, CatalogOrigin[]>();
    for (const offer of offers) {
      const origin = offer.priceListVersion.priceList;
      const origins = offerOrigins.get(offer.productCode) ?? [];
      origins.push(origin);
      offerOrigins.set(offer.productCode, origins);
    }

    const products =
      includeProducts && offerOrigins.size
        ? await this.prisma.product.findMany({
            where: {
              code: { in: [...offerOrigins.keys()] },
              ...(query.filter === 'WITHOUT_IMAGE' ? { currentImageId: null } : {}),
              ...(search
                ? {
                    OR: [
                      { code: { contains: search } },
                      { description: { contains: search } },
                      { reference: { contains: search } },
                    ],
                  }
                : {}),
            },
            orderBy: { code: 'asc' },
            select: {
              id: true,
              code: true,
              description: true,
              reference: true,
              currentImage: { select: imageSelect },
            },
          })
        : [];

    const items: CatalogItem[] = [
      ...kits.flatMap((kit): CatalogItem[] => {
        const availableSeries = kit.calculationSeries.filter((series) => series.calculations[0]);
        const calculation = availableSeries[0]?.calculations[0];
        if (!calculation) return [];
        return [
          {
            kind: 'KIT',
            entityId: kit.id,
            code: kit.code,
            description: calculation.catalogDescription ?? kit.description,
            reference: kit.reference,
            image: kit.currentImage ? imageReference(kit.currentImage) : null,
            origins: uniqueOrigins(availableSeries.map((series) => series.priceList)),
            compositionCalculationId: calculation.id,
            scope: calculation.catalogScope,
          },
        ];
      }),
      ...products.map((product): CatalogItem => ({
        kind: 'PRODUCT',
        entityId: product.id,
        code: product.code,
        description: product.description,
        reference: product.reference,
        image: product.currentImage ? imageReference(product.currentImage) : null,
        origins: uniqueOrigins(offerOrigins.get(product.code) ?? []),
      })),
    ].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR') || a.kind.localeCompare(b.kind));

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.pageSize;
    return {
      data: { items: items.slice(start, start + query.pageSize) },
      pagination: { page, pageSize: query.pageSize, total, totalPages },
    };
  }
}
