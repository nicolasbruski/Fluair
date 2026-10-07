import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('migração dos impostos das listas com estrutura', () => {
  it('preenche versões antigas e permite impostos nos componentes', () => {
    const migration = readFileSync(
      'prisma/migrations/20261007150000_kit_price_list_taxes/migration.sql',
      'utf8',
    );

    expect(migration).toContain('SET `ipi_rate` = 0.0000');
    expect(migration).toContain('`ipi_included` = false');
    expect(migration).toContain('`minimum_price` IS NOT NULL');
    expect(migration).toContain('`ipi_rate` IS NOT NULL');
  });
});
