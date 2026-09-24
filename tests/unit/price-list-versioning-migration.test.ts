import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260913180000_price_list_versioning_and_history/migration.sql',
);
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const divergenceReportPath = resolve(process.cwd(), 'scripts/price-list-history-divergences.sql');

describe('versionamento geral e migração histórica das listas', () => {
  it('modela versões e itens dos dois formatos sem preço ambíguo', async () => {
    const [migration, schema] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(schemaPath, 'utf8'),
    ]);

    expect(migration).toContain('CREATE TABLE `price_list_versions`');
    expect(migration).toContain('CREATE TABLE `price_list_items`');
    expect(migration).toContain('DECIMAL(15,4) NULL');
    expect(migration).toContain('`ipi_included` = true');
    expect(migration).toContain(
      'UNIQUE INDEX `price_list_items_price_list_version_id_product_code_key`',
    );
    expect(schema).toContain('model PriceListVersion');
    expect(schema).toContain('description        String?');
    expect(schema).toContain('unitPrice          Decimal?');
  });

  it('copia UUIDs e fotografias e mantém todo o legado', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toMatch(/INSERT INTO `price_lists`[\s\S]*SELECT[\s\S]*FROM `price_profiles`/);
    expect(migration).toMatch(
      /INSERT INTO `price_list_versions`[\s\S]*FROM `price_matrix_versions`/,
    );
    expect(migration).toMatch(/INSERT INTO `price_list_items`[\s\S]*FROM `price_matrix_items`/);
    expect(migration).toMatch(/INSERT INTO `kit_calculation_series`[\s\S]*FROM `kit_price_lists`/);
    expect(migration).toContain('`kit_calculation_series_id` = `price_list_id`');
    expect(migration).toContain('`price_list_version_id` = `matrix_version_id`');
    expect(migration).not.toMatch(/\b(?:DROP TABLE|DROP COLUMN|DELETE FROM)\b/i);
  });

  it('bloqueia o corte com divergência e fornece relatório somente leitura', async () => {
    const [migration, report] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(divergenceReportPath, 'utf8'),
    ]);

    expect(migration).toContain('`violations` = 0');
    expect(migration).toContain('`series`.`price_list_id` <> `version`.`price_list_id`');
    expect(report).toContain('VERSION_SNAPSHOT_MISMATCH');
    expect(report).toContain('ITEM_SNAPSHOT_MISMATCH');
    expect(report).toContain('ACTIVE_VERSION_MISMATCH');
    expect(report).toContain('CALCULATION_RELATION_MISMATCH');
    expect(report).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
  });
});
