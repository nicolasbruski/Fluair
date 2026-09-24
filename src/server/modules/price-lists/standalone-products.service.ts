import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  StandaloneProductCatalogEnvelope,
  StandaloneProductCatalogItem,
  StandaloneProductPriceEnvelope,
} from '../../../shared/pricing.js';
import { imageReference, type NullableImageReference } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';

export interface StandaloneProductsQuery {
  search: string;
  page: number;
  pageSize: number;
}

export interface StandalonePriceResolution {
  priceListId: string;
  priceListCode: string;
  priceListName: string;
  priceListVersionId: string;
  priceListVersion: number;
  productId: string | null;
  productCode: string;
  description: string;
  reference: string;
  unitPrice: Prisma.Decimal;
  ipiRate: Prisma.Decimal;
  ipiIncluded: true;
  icmsRate: Prisma.Decimal;
  sourceRow: number;
  image: NullableImageReference;
}

interface ActiveStandaloneList {
  id: string;
  code: string;
  name: string;
  type: 'KIT_COMPONENT' | 'STANDALONE_PRODUCT';
  active: boolean;
  activeVersion: { id: string; version: number } | null;
}

function assertStandaloneList(
  list: ActiveStandaloneList | null,
): asserts list is ActiveStandaloneList & { activeVersion: { id: string; version: number } } {
  if (!list) throw new AppError(404, 'PRICE_LIST_NOT_FOUND', 'Lista de preço não encontrada.');
  if (list.type !== 'STANDALONE_PRODUCT') {
    throw new AppError(
      422,
      'PRICE_LIST_TYPE_MISMATCH',
      'Somente listas de produtos sem estrutura possuem catálogo avulso.',
    );
  }
  if (!list.active)
    throw new AppError(422, 'PRICE_LIST_INACTIVE', 'A lista de preço está inativa.');
  if (!list.activeVersion) {
    throw new AppError(
      422,
      'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
      'A lista não possui versão ativa.',
    );
  }
}

function catalogItem(
  item: {
    productCode: string;
    description: string | null;
    reference: string | null;
    unitPrice: Prisma.Decimal | null;
    ipiRate: Prisma.Decimal | null;
    ipiIncluded: boolean | null;
    icmsRate: Prisma.Decimal;
    sourceRow: number;
  },
  productId: string | null,
  image: NullableImageReference,
): StandaloneProductCatalogItem {
  if (!item.unitPrice || !item.ipiRate || item.ipiIncluded !== true) {
    throw new AppError(
      422,
      'STANDALONE_PRODUCT_PRICE_INVALID',
      'O item não possui um preço avulso válido nesta versão.',
    );
  }
  return {
    productId,
    code: item.productCode,
    description: item.description ?? '',
    reference: item.reference ?? '',
    unitPrice: item.unitPrice.toString(),
    ipiRate: item.ipiRate.toString(),
    ipiIncluded: true,
    icmsRate: item.icmsRate.toString(),
    sourceRow: item.sourceRow,
    image,
  };
}

export class StandaloneProductsService {
  constructor(private readonly prisma: PrismaClient) {}

  private async activeList(id: string): Promise<
    ActiveStandaloneList & {
      activeVersion: { id: string; version: number };
    }
  > {
    const list = await this.prisma.priceList.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        active: true,
        activeVersion: { select: { id: true, version: true } },
      },
    });
    assertStandaloneList(list);
    return list;
  }

  async list(
    priceListId: string,
    query: StandaloneProductsQuery,
  ): Promise<StandaloneProductCatalogEnvelope> {
    const list = await this.activeList(priceListId);
    const search = query.search.trim();
    const where: Prisma.PriceListItemWhereInput = {
      priceListVersionId: list.activeVersion.id,
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              { reference: { contains: search } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.priceListItem.count({ where }),
      this.prisma.priceListItem.findMany({
        where,
        orderBy: [{ sourceRow: 'asc' }, { productCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          productCode: true,
          description: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
          icmsRate: true,
          sourceRow: true,
        },
      }),
    ]);
    const identities = await this.prisma.product.findMany({
      where: { code: { in: items.map(({ productCode }) => productCode) } },
      select: {
        id: true,
        code: true,
        currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
      },
    });
    const products = new Map(identities.map((identity) => [identity.code, identity]));
    return {
      data: {
        priceList: { id: list.id, code: list.code, name: list.name, type: list.type },
        version: list.activeVersion,
        products: items.map((item) => {
          const product = products.get(item.productCode);
          return catalogItem(
            item,
            product?.id ?? null,
            product?.currentImage ? imageReference(product.currentImage) : null,
          );
        }),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async resolveStandalonePrice(
    priceListId: string,
    productCode: string,
    expectedVersionId?: string,
  ): Promise<StandalonePriceResolution> {
    const list = await this.activeList(priceListId);
    if (expectedVersionId && list.activeVersion.id !== expectedVersionId) {
      throw new AppError(
        409,
        'ACTIVE_PRICE_LIST_VERSION_CHANGED',
        'A versão ativa da lista mudou. Atualize os produtos antes de continuar.',
      );
    }
    const item = await this.prisma.priceListItem.findUnique({
      where: {
        priceListVersionId_productCode: {
          priceListVersionId: list.activeVersion.id,
          productCode,
        },
      },
      select: {
        productCode: true,
        description: true,
        reference: true,
        unitPrice: true,
        ipiRate: true,
        ipiIncluded: true,
        icmsRate: true,
        sourceRow: true,
      },
    });
    if (!item) {
      throw new AppError(
        404,
        'STANDALONE_PRODUCT_NOT_FOUND',
        'O produto não existe na versão ativa da lista selecionada.',
      );
    }
    const identity = await this.prisma.product.findUnique({
      where: { code: productCode },
      select: {
        id: true,
        currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
      },
    });
    const product = catalogItem(
      item,
      identity?.id ?? null,
      identity?.currentImage ? imageReference(identity.currentImage) : null,
    );
    return {
      priceListId: list.id,
      priceListCode: list.code,
      priceListName: list.name,
      priceListVersionId: list.activeVersion.id,
      priceListVersion: list.activeVersion.version,
      productId: product.productId,
      productCode: product.code,
      description: product.description,
      reference: product.reference,
      unitPrice: new Prisma.Decimal(product.unitPrice),
      ipiRate: new Prisma.Decimal(product.ipiRate),
      ipiIncluded: true,
      icmsRate: new Prisma.Decimal(product.icmsRate),
      sourceRow: product.sourceRow,
      image: product.image,
    };
  }

  async price(priceListId: string, productCode: string): Promise<StandaloneProductPriceEnvelope> {
    const resolved = await this.resolveStandalonePrice(priceListId, productCode);
    return {
      data: {
        priceList: {
          id: resolved.priceListId,
          code: resolved.priceListCode,
          name: resolved.priceListName,
          type: 'STANDALONE_PRODUCT',
        },
        version: { id: resolved.priceListVersionId, version: resolved.priceListVersion },
        product: {
          productId: resolved.productId,
          code: resolved.productCode,
          description: resolved.description,
          reference: resolved.reference,
          unitPrice: resolved.unitPrice.toString(),
          ipiRate: resolved.ipiRate.toString(),
          ipiIncluded: true,
          icmsRate: resolved.icmsRate.toString(),
          sourceRow: resolved.sourceRow,
          image: resolved.image,
        },
      },
    };
  }
}
