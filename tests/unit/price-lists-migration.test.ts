import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260913164000_price_lists/migration.sql',
);
const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');

describe('definição geral de listas de preço', () => {
  it('cria a estrutura de forma aditiva e preserva o legado', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `price_lists`');
    expect(migration).toContain('UNIQUE INDEX `price_lists_code_key` (`code`)');
    expect(migration).toContain(
      'UNIQUE INDEX `price_lists_active_version_id_key` (`active_version_id`)',
    );
    expect(migration).not.toMatch(/\b(?:DROP|DELETE|UPDATE|INSERT)\b/i);
    expect(migration).not.toMatch(
      /\bALTER\s+TABLE\s+`?(?:price_profiles|price_matrix_versions|kit_price_lists)`?/i,
    );
  });

  it('representa os dois tipos, a situação e a faixa opcional', async () => {
    const [migration, schema] = await Promise.all([
      readFile(migrationPath, 'utf8'),
      readFile(schemaPath, 'utf8'),
    ]);

    expect(migration).toContain("ENUM('KIT_COMPONENT', 'STANDALONE_PRODUCT')");
    expect(migration).toContain('`active` BOOLEAN NOT NULL DEFAULT true');
    expect(schema).toMatch(
      /enum PriceListType\s*{[^}]*KIT_COMPONENT[^}]*STANDALONE_PRODUCT[^}]*}/s,
    );
    expect(schema).toContain('minimumOrderQuantity Int?');
    expect(schema).toContain('maximumOrderQuantity Int?');
    expect(schema).toContain('activeVersionId      String?');
  });

  it('bloqueia limites negativos e faixa invertida no banco', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('`minimum_order_quantity` >= 0');
    expect(migration).toContain('`maximum_order_quantity` >= 0');
    expect(migration).toContain('`minimum_order_quantity` <= `maximum_order_quantity`');
    expect(migration).toContain('`maximum_order_quantity` IS NULL');
  });
});
