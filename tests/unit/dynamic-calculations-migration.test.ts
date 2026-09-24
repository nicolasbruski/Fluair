import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260913190000_dynamic_calculations/migration.sql',
);
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');

describe('migração do cálculo para listas dinâmicas', () => {
  it('mantém FKs legadas opcionais e versiona pela série dinâmica', async () => {
    const [migration, schema] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(schemaPath, 'utf8'),
    ]);

    expect(migration).toContain('MODIFY `price_list_id` CHAR(36) NULL');
    expect(migration).toContain('MODIFY `matrix_version_id` CHAR(36) NULL');
    expect(migration).toContain('`calculation_versions_kit_calculation_series_id_version_key`');
    expect(schema).toContain('@@unique([kitCalculationSeriesId, version])');
  });

  it('fotografa cliente e classe sem apagar o vínculo histórico', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('`customer_code_snapshot`');
    expect(migration).toContain('`customer_name_snapshot`');
    expect(migration).toContain('`class_code_snapshot`');
    expect(migration).toContain('`class_name_snapshot`');
    expect(migration).toMatch(/UPDATE `calculation_customers`[\s\S]*JOIN `customer_classes`/);
    expect(migration).not.toMatch(/\b(?:DROP TABLE|DROP COLUMN|DELETE FROM)\b/i);
  });
});
