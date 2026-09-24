import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath = 'prisma/migrations/20260918120000_standalone_product_icms/migration.sql';

describe('migração do ICMS de produtos avulsos', () => {
  it('armazena a alíquota no item versionado e preserva versões anteriores com zero', async () => {
    const [schema, migration] = await Promise.all([
      readFile('prisma/schema.prisma', 'utf8'),
      readFile(migrationPath, 'utf8'),
    ]);

    const itemModel = schema.match(/model PriceListItem \{[\s\S]*?\n\}/)?.[0] ?? '';
    const productModel = schema.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(itemModel).toContain('icmsRate');
    expect(productModel).not.toContain('icmsRate');
    expect(migration).toMatch(/ADD COLUMN `icms_rate` DECIMAL\(7, 4\) NOT NULL DEFAULT 0\.0000/i);
  });
});
