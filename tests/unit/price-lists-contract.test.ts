import { describe, expect, expectTypeOf, it } from 'vitest';

import { PRICE_LIST_TYPES } from '../../src/shared/pricing.js';
import type {
  CreatePriceListInput,
  PriceListDto,
  PriceListImportEnvelope,
  PriceListImportPreviewEnvelope,
  PriceListImportSummary,
  PriceListsEnvelope,
  PriceListTypeCode,
  SpreadsheetDiagnostic,
  UpdatePriceListInput,
} from '../../src/shared/pricing.js';

describe('contrato compartilhado de listas de preço', () => {
  it('expõe tipos de domínio sem códigos fixos das listas cadastradas', () => {
    expect(PRICE_LIST_TYPES).toEqual(['KIT_COMPONENT', 'STANDALONE_PRODUCT']);
    expectTypeOf<PriceListDto['code']>().toEqualTypeOf<string>();
    expectTypeOf<PriceListDto['type']>().toEqualTypeOf<PriceListTypeCode>();
  });

  it('inclui público, faixa, versão ativa e histórico versionado', () => {
    expectTypeOf<PriceListDto['customerClasses']>().toBeArray();
    expectTypeOf<PriceListDto['customerSegments']>().toBeArray();
    expectTypeOf<PriceListDto['minimumOrderQuantity']>().toEqualTypeOf<number | null>();
    expectTypeOf<PriceListDto['activeVersion']>().toEqualTypeOf<
      PriceListDto['versions'][number] | null
    >();
    expectTypeOf<PriceListsEnvelope['data']['priceLists']>().toEqualTypeOf<PriceListDto[]>();
  });

  it('define entradas administrativas e resumo de importação reutilizável', () => {
    expectTypeOf<CreatePriceListInput['type']>().toEqualTypeOf<PriceListTypeCode>();
    expectTypeOf<UpdatePriceListInput['customerClassIds']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<PriceListImportSummary['warnings']>().toEqualTypeOf<SpreadsheetDiagnostic[]>();
    expectTypeOf<PriceListImportPreviewEnvelope['data']['preview']['errors']>().toEqualTypeOf<
      SpreadsheetDiagnostic[]
    >();
    expectTypeOf<
      PriceListImportEnvelope['data']['imported']
    >().toEqualTypeOf<PriceListImportSummary>();
  });
});
