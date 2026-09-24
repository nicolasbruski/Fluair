import { describe, expect, it, vi } from 'vitest';

import {
  INITIAL_PRICE_LISTS,
  INITIAL_PRICE_LIST_SEGMENTS,
  seedInitialPriceLists,
} from '../../prisma/seed/initial-price-lists.js';

describe('configuração inicial de listas de preço', () => {
  it('representa listas de componentes por classe sem versões ou preços', () => {
    const componentLists = INITIAL_PRICE_LISTS.filter(({ type }) => type === 'KIT_COMPONENT');

    expect(
      componentLists.map(({ code, customerClassCodes }) => [code, customerClassCodes]),
    ).toEqual([
      ['IMPLEMENTER', ['IMPLEMENTER']],
      ['TRADE_REPLACEMENT', ['RESELLER']],
      ['END_CONSUMER', ['END_CONSUMER']],
      ['EXPORT', ['EXPORT']],
    ]);
    expect(componentLists.every((list) => !('activeVersionId' in list))).toBe(true);
    expect(componentLists.every((list) => !('price' in list))).toBe(true);
  });

  it('cadastra segmentos estruturais e as faixas inclusivas 0–49, 50–99 e 100+', () => {
    expect(INITIAL_PRICE_LIST_SEGMENTS).toEqual([
      { code: 'INDUSTRY', name: 'Indústria' },
      { code: 'EXPORT', name: 'Exportação' },
    ]);

    const resellerRanges = INITIAL_PRICE_LISTS.filter(({ code }) => code.startsWith('RESELLER_'));
    expect(
      resellerRanges.map(({ minimumOrderQuantity, maximumOrderQuantity }) => [
        minimumOrderQuantity,
        maximumOrderQuantity,
      ]),
    ).toEqual([
      [0, 49],
      [50, 99],
      [100, null],
    ]);
    expect(
      new Set(resellerRanges.flatMap(({ customerSegmentCodes }) => customerSegmentCodes)),
    ).toEqual(new Set(['AUTO_PARTS', 'SERVICE_STATION', 'DISTRIBUTOR', 'AUTHORIZED']));
  });

  it('é repetível, mantém versões ativas fora do seed e não duplica associações', async () => {
    const classes = new Map(
      ['IMPLEMENTER', 'RESELLER', 'END_CONSUMER', 'EXPORT'].map((code) => [code, { id: code }]),
    );
    const segments = new Map(
      ['AUTO_PARTS', 'SERVICE_STATION', 'DISTRIBUTOR', 'AUTHORIZED'].map((code) => [
        code,
        { id: code },
      ]),
    );
    const lists = new Map<string, { id: string; activeVersionId?: string }>();
    const classLinks = new Set<string>();
    const segmentLinks = new Set<string>();
    const priceListUpsert = vi.fn(
      async ({ where }: { where: { code: string }; update: Record<string, unknown> }) => {
        const existing = lists.get(where.code);
        const result = existing ?? { id: where.code };
        lists.set(where.code, result);
        return result;
      },
    );
    const prisma = {
      customerClass: {
        findUnique: async ({ where }: { where: { code: string } }) =>
          classes.get(where.code) ?? null,
      },
      customerSegment: {
        upsert: async ({ where }: { where: { code: string } }) => {
          const result = segments.get(where.code) ?? { id: where.code };
          segments.set(where.code, result);
          return result;
        },
        findUnique: async ({ where }: { where: { code: string } }) =>
          segments.get(where.code) ?? null,
      },
      priceList: { upsert: priceListUpsert },
      priceListClass: {
        upsert: async ({
          create,
        }: {
          create: { priceListId: string; customerClassId: string };
        }) => {
          classLinks.add(`${create.priceListId}:${create.customerClassId}`);
        },
      },
      priceListSegment: {
        upsert: async ({
          create,
        }: {
          create: { priceListId: string; customerSegmentId: string };
        }) => {
          segmentLinks.add(`${create.priceListId}:${create.customerSegmentId}`);
        },
      },
    };

    await seedInitialPriceLists(prisma as never);
    lists.get('IMPLEMENTER')!.activeVersionId = 'historical-version';
    await seedInitialPriceLists(prisma as never);

    expect(priceListUpsert).toHaveBeenCalledTimes(INITIAL_PRICE_LISTS.length * 2);
    expect(lists).toHaveLength(INITIAL_PRICE_LISTS.length);
    expect(classLinks).toHaveLength(4);
    expect(segmentLinks).toHaveLength(14);
    expect(lists.get('IMPLEMENTER')).toMatchObject({ activeVersionId: 'historical-version' });
    for (const call of priceListUpsert.mock.calls) {
      expect(call[0].update).not.toHaveProperty('activeVersionId');
    }
  });
});
