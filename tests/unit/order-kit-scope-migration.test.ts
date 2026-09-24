import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260917120000_order_catalog_scopes/migration.sql',
);

describe('migração do alcance dos kits no pedido', () => {
  it('mantém cálculos existentes exclusivos e indexa o catálogo', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("ENUM('CUSTOMER_SPECIFIC', 'STANDARD')");
    expect(migration).toContain("NOT NULL DEFAULT 'CUSTOMER_SPECIFIC'");
    expect(migration).toContain('calculation_versions_catalog_scope_catalog_visible_idx');
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE)\b/im);
  });
});
