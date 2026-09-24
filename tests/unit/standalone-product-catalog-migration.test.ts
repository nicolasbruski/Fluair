import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260913200000_standalone_product_catalog/migration.sql',
);
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');

describe('migração do catálogo de produtos sem estrutura', () => {
  it('amplia somente a identidade e mantém preço fora de products', async () => {
    const [migration, schema] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(schemaPath, 'utf8'),
    ]);
    const productModel = schema.match(/model Product \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(migration).toMatch(/ADD COLUMN .*reference.* VARCHAR\(120\) NULL/);
    expect(migration).toMatch(/MODIFY .*unit.* VARCHAR\(30\) NULL/);
    expect(productModel).toContain('reference');
    expect(productModel).not.toMatch(/(?:price|ipi)/i);
    expect(migration).toMatch(/INSERT INTO .*products[\s\S]*STANDALONE_PRODUCT/);
    expect(migration).toMatch(/UPDATE .*products[\s\S]*NOT EXISTS/);
  });

  it('indexa os campos pesquisáveis preservados na fotografia da versão', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toMatch(/price_list_items_description_idx/);
    expect(migration).toMatch(/price_list_items_reference_idx/);
    expect(migration).not.toMatch(/\b(?:DROP TABLE|DROP COLUMN|DELETE FROM)\b/i);
  });
});
