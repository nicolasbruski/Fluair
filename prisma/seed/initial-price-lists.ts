export const INITIAL_PRICE_LIST_SEGMENTS = [
  { code: 'INDUSTRY', name: 'Indústria' },
  { code: 'EXPORT', name: 'Exportação' },
] as const;

export const INITIAL_PRICE_LISTS = [
  {
    code: 'IMPLEMENTER',
    name: 'Implementador',
    type: 'KIT_COMPONENT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: ['IMPLEMENTER'],
    customerSegmentCodes: [],
  },
  {
    code: 'TRADE_REPLACEMENT',
    name: 'Revenda',
    type: 'KIT_COMPONENT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: ['RESELLER'],
    customerSegmentCodes: [],
  },
  {
    code: 'END_CONSUMER',
    name: 'Consumidor Final',
    type: 'KIT_COMPONENT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: ['END_CONSUMER'],
    customerSegmentCodes: [],
  },
  {
    code: 'EXPORT',
    name: 'Exportação',
    type: 'KIT_COMPONENT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: ['EXPORT'],
    customerSegmentCodes: [],
  },
  {
    code: 'INDUSTRY_PRODUCTS',
    name: 'Indústria',
    type: 'STANDALONE_PRODUCT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: [],
    customerSegmentCodes: ['INDUSTRY'],
  },
  {
    code: 'RESELLER_PRODUCTS_0_49',
    name: 'Revenda até 49 peças',
    type: 'STANDALONE_PRODUCT',
    minimumOrderQuantity: 0,
    maximumOrderQuantity: 49,
    customerClassCodes: [],
    customerSegmentCodes: ['AUTO_PARTS', 'SERVICE_STATION', 'DISTRIBUTOR', 'AUTHORIZED'],
  },
  {
    code: 'RESELLER_PRODUCTS_50_99',
    name: 'Revenda 50 a 99 peças',
    type: 'STANDALONE_PRODUCT',
    minimumOrderQuantity: 50,
    maximumOrderQuantity: 99,
    customerClassCodes: [],
    customerSegmentCodes: ['AUTO_PARTS', 'SERVICE_STATION', 'DISTRIBUTOR', 'AUTHORIZED'],
  },
  {
    code: 'RESELLER_PRODUCTS_100_PLUS',
    name: 'Revenda 100+',
    type: 'STANDALONE_PRODUCT',
    minimumOrderQuantity: 100,
    maximumOrderQuantity: null,
    customerClassCodes: [],
    customerSegmentCodes: ['AUTO_PARTS', 'SERVICE_STATION', 'DISTRIBUTOR', 'AUTHORIZED'],
  },
  {
    code: 'EXPORT_PRODUCTS',
    name: 'Exportação',
    type: 'STANDALONE_PRODUCT',
    minimumOrderQuantity: null,
    maximumOrderQuantity: null,
    customerClassCodes: [],
    customerSegmentCodes: ['EXPORT'],
  },
] as const;

type PriceListType = 'KIT_COMPONENT' | 'STANDALONE_PRODUCT';
type Entity = { id: string };

interface InitialPriceListSeedClient {
  customerClass: {
    findUnique(args: { where: { code: string }; select: { id: true } }): Promise<Entity | null>;
  };
  customerSegment: {
    upsert(args: {
      where: { code: string };
      update: { name: string; active: true };
      create: { code: string; name: string; active: true };
      select: { id: true };
    }): Promise<Entity>;
    findUnique(args: { where: { code: string }; select: { id: true } }): Promise<Entity | null>;
  };
  priceList: {
    upsert(args: {
      where: { code: string };
      update: {
        name: string;
        type: PriceListType;
        active: true;
        minimumOrderQuantity: number | null;
        maximumOrderQuantity: number | null;
      };
      create: {
        code: string;
        name: string;
        type: PriceListType;
        active: true;
        minimumOrderQuantity: number | null;
        maximumOrderQuantity: number | null;
      };
      select: { id: true };
    }): Promise<Entity>;
  };
  priceListClass: {
    upsert(args: {
      where: { priceListId_customerClassId: { priceListId: string; customerClassId: string } };
      update: Record<string, never>;
      create: { priceListId: string; customerClassId: string };
    }): Promise<unknown>;
  };
  priceListSegment: {
    upsert(args: {
      where: {
        priceListId_customerSegmentId: { priceListId: string; customerSegmentId: string };
      };
      update: Record<string, never>;
      create: { priceListId: string; customerSegmentId: string };
    }): Promise<unknown>;
  };
}

async function requireId(
  entity: Promise<Entity | null>,
  entityName: string,
  code: string,
): Promise<string> {
  const result = await entity;
  if (!result) throw new Error(`${entityName} estrutural ausente: ${code}`);
  return result.id;
}

export async function seedInitialPriceLists(prisma: InitialPriceListSeedClient): Promise<void> {
  for (const segment of INITIAL_PRICE_LIST_SEGMENTS) {
    await prisma.customerSegment.upsert({
      where: { code: segment.code },
      update: { name: segment.name, active: true },
      create: { ...segment, active: true },
      select: { id: true },
    });
  }

  for (const definition of INITIAL_PRICE_LISTS) {
    const priceList = await prisma.priceList.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        type: definition.type,
        active: true,
        minimumOrderQuantity: definition.minimumOrderQuantity,
        maximumOrderQuantity: definition.maximumOrderQuantity,
      },
      create: {
        code: definition.code,
        name: definition.name,
        type: definition.type,
        active: true,
        minimumOrderQuantity: definition.minimumOrderQuantity,
        maximumOrderQuantity: definition.maximumOrderQuantity,
      },
      select: { id: true },
    });

    for (const code of definition.customerClassCodes) {
      const customerClassId = await requireId(
        prisma.customerClass.findUnique({ where: { code }, select: { id: true } }),
        'Classe',
        code,
      );
      await prisma.priceListClass.upsert({
        where: {
          priceListId_customerClassId: { priceListId: priceList.id, customerClassId },
        },
        update: {},
        create: { priceListId: priceList.id, customerClassId },
      });
    }

    for (const code of definition.customerSegmentCodes) {
      const customerSegmentId = await requireId(
        prisma.customerSegment.findUnique({ where: { code }, select: { id: true } }),
        'Segmento',
        code,
      );
      await prisma.priceListSegment.upsert({
        where: {
          priceListId_customerSegmentId: { priceListId: priceList.id, customerSegmentId },
        },
        update: {},
        create: { priceListId: priceList.id, customerSegmentId },
      });
    }
  }
}
