import { describe, expect, expectTypeOf, it } from 'vitest';

import { legacyCustomerSegmentLabel } from '../../src/shared/customers.js';
import type {
  Customer,
  CustomerClass,
  CustomerClassificationsEnvelope,
  CustomerFilters,
  CustomerQuery,
  CustomerSegment,
} from '../../src/shared/customers.js';

describe('contrato compartilhado de clientes', () => {
  it('mantém os rótulos históricos consumidos por comissões', () => {
    expect(
      legacyCustomerSegmentLabel({
        id: '40000000-0000-4000-8000-000000000003',
        code: 'AUTO_PARTS',
        name: 'Autopeças',
        active: true,
      }),
    ).toBe('AUTO-PECAS');
    expect(
      legacyCustomerSegmentLabel({ id: 'future', code: 'FUTURE', name: 'Futuro', active: true }),
    ).toBe('Futuro');
  });

  it('distingue classe e segmento normalizado na resposta', () => {
    expectTypeOf<Customer['cnpj']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Customer['city']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Customer['state']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Customer['customerClass']>().toEqualTypeOf<CustomerClass | null>();
    expectTypeOf<Customer['customerSegment']>().toEqualTypeOf<CustomerSegment | null>();
    expectTypeOf<Customer['segment']>().toEqualTypeOf<string | null>();
  });

  it('oferece filtros normalizados sem remover os campos legados', () => {
    expectTypeOf<CustomerFilters['customerClasses']>().toEqualTypeOf<CustomerClass[] | undefined>();
    expectTypeOf<CustomerFilters['customerSegments']>().toEqualTypeOf<
      CustomerSegment[] | undefined
    >();
    expectTypeOf<CustomerFilters['segments']>().toEqualTypeOf<string[]>();
    expectTypeOf<CustomerQuery['customerClassId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<CustomerQuery['customerSegmentId']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<CustomerQuery['segment']>().toEqualTypeOf<string | undefined>();
  });

  it('define a resposta das opções ativas de classificação', () => {
    expectTypeOf<CustomerClassificationsEnvelope['data']['customerClasses']>().toEqualTypeOf<
      CustomerClass[]
    >();
    expectTypeOf<CustomerClassificationsEnvelope['data']['customerSegments']>().toEqualTypeOf<
      CustomerSegment[]
    >();
  });
});
