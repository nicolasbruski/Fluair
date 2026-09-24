import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/server/errors/app-error.js';
import { PriceListsService } from '../../src/server/modules/price-lists/price-lists.service.js';

const policyList = {
  id: 'list-1',
  type: 'STANDALONE_PRODUCT' as const,
  active: true,
  minimumOrderQuantity: 50,
  maximumOrderQuantity: 99,
  activeVersionId: 'version-1',
  customerClassIds: ['class-1'],
  customerSegmentIds: ['segment-1'],
};

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260913170000_price_list_audiences/migration.sql',
);

function expectAppError(operation: () => void, code: string, status = 422): void {
  try {
    operation();
    expect.fail('A validação deveria rejeitar a associação incompatível.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status, code });
  }
}

describe('associações de público das listas de preço', () => {
  it('persiste relações muitos-para-muitos únicas e protegidas por FKs', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `price_list_classes`');
    expect(migration).toContain('PRIMARY KEY (`price_list_id`, `customer_class_id`)');
    expect(migration).toContain('CREATE TABLE `price_list_segments`');
    expect(migration).toContain('PRIMARY KEY (`price_list_id`, `customer_segment_id`)');
    expect(migration.match(/ON DELETE RESTRICT ON UPDATE CASCADE/g)).toHaveLength(4);
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|INSERT)\b/im);
  });

  it('aceita somente classes em listas de componentes', () => {
    const service = new PriceListsService();

    expect(() =>
      service.validateAudience('KIT_COMPONENT', {
        customerClassIds: ['class-1'],
        customerSegmentIds: [],
      }),
    ).not.toThrow();
    expectAppError(
      () =>
        service.validateAudience('KIT_COMPONENT', {
          customerClassIds: [],
          customerSegmentIds: ['segment-1'],
        }),
      'PRICE_LIST_SEGMENTS_NOT_ALLOWED',
    );
  });

  it('aceita somente segmentos em listas de produtos avulsos', () => {
    const service = new PriceListsService();

    expect(() =>
      service.validateAudience('STANDALONE_PRODUCT', {
        customerClassIds: [],
        customerSegmentIds: ['segment-1', 'segment-2'],
      }),
    ).not.toThrow();
    expectAppError(
      () =>
        service.validateAudience('STANDALONE_PRODUCT', {
          customerClassIds: ['class-1'],
          customerSegmentIds: [],
        }),
      'PRICE_LIST_CLASSES_NOT_ALLOWED',
    );
  });

  it('valida existência, tipo, situação e versão ativa com erros estáveis', () => {
    const service = new PriceListsService();

    expectAppError(
      () => service.assertUsable(null, { expectedType: 'KIT_COMPONENT' }),
      'PRICE_LIST_NOT_FOUND',
      404,
    );
    expectAppError(
      () => service.assertUsable(policyList, { expectedType: 'KIT_COMPONENT' }),
      'PRICE_LIST_TYPE_MISMATCH',
    );
    expectAppError(
      () => service.assertUsable({ ...policyList, active: false }),
      'PRICE_LIST_INACTIVE',
    );
    expectAppError(
      () =>
        service.assertUsable(
          { ...policyList, activeVersionId: null },
          { requireActiveVersion: true },
        ),
      'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
    );
    expect(() =>
      service.assertUsable(policyList, {
        expectedType: 'STANDALONE_PRODUCT',
        requireActiveVersion: true,
      }),
    ).not.toThrow();
  });

  it('trata os limites da faixa como inclusivos e suporta limites abertos', () => {
    const service = new PriceListsService();

    expect(() => service.assertQuantityAllowed(policyList, 50)).not.toThrow();
    expect(() => service.assertQuantityAllowed(policyList, 99)).not.toThrow();
    expectAppError(
      () => service.assertQuantityAllowed(policyList, 49),
      'PRICE_LIST_QUANTITY_OUT_OF_RANGE',
    );
    expectAppError(
      () => service.assertQuantityAllowed(policyList, 100),
      'PRICE_LIST_QUANTITY_OUT_OF_RANGE',
    );
    expect(() =>
      service.assertQuantityAllowed(
        { ...policyList, minimumOrderQuantity: 100, maximumOrderQuantity: null },
        100,
      ),
    ).not.toThrow();
    expect(() =>
      service.assertQuantityAllowed(
        { ...policyList, minimumOrderQuantity: null, maximumOrderQuantity: null },
        10_000,
      ),
    ).not.toThrow();
  });

  it('autoriza classe e segmento somente quando classificados e associados', () => {
    const service = new PriceListsService();

    expect(() => service.assertClassAllowed(policyList, 'class-1')).not.toThrow();
    expect(() => service.assertSegmentAllowed(policyList, 'segment-1')).not.toThrow();
    expectAppError(() => service.assertClassAllowed(policyList, null), 'CUSTOMER_CLASS_REQUIRED');
    expectAppError(
      () => service.assertClassAllowed(policyList, 'class-2'),
      'PRICE_LIST_CLASS_NOT_ALLOWED',
    );
    expectAppError(
      () => service.assertSegmentAllowed(policyList, null),
      'CUSTOMER_SEGMENT_REQUIRED',
    );
    expectAppError(
      () => service.assertSegmentAllowed(policyList, 'segment-2'),
      'PRICE_LIST_SEGMENT_NOT_ALLOWED',
    );
  });
});
