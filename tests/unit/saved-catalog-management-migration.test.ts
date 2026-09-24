import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260915120000_saved_catalog_management/migration.sql',
);

describe('migração de gerenciamento do catálogo salvo', () => {
  it('adiciona sobrescritas e exclusão lógica sem apagar o histórico', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('catalog_description');
    expect(migration).toContain('catalog_minimum_price');
    expect(migration).toContain('catalog_normal_price');
    expect(migration).toContain('catalog_visible');
    expect(migration).toContain('DEFAULT TRUE');
    expect(migration).not.toMatch(/\b(?:DROP TABLE|DROP COLUMN|DELETE FROM)\b/i);
  });
});
