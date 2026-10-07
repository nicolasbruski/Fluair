import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('migração dos impostos por item do pedido', () => {
  it('versiona PIS e Cofins e fotografa seleção, alíquota e valor final', async () => {
    const migration = await readFile(
      'prisma/migrations/20261005210000_order_item_taxes/migration.sql',
      'utf8',
    );

    expect(migration).toContain('`pis_rate` DECIMAL(7, 4)');
    expect(migration).toContain('`cofins_rate` DECIMAL(7, 4)');
    expect(migration).toContain('SET `ipi_included` = false');
    expect(migration).toContain('WHERE `unit_price` IS NOT NULL');
    expect(migration).toContain('`pis_selected` BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('`ipi_selected` BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('`total_tax_unit_amount` DECIMAL(15, 4)');
    expect(migration).toContain('`final_unit_price` DECIMAL(15, 4)');
  });
});
