import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260918130000_fix_excel_tax_percentage_scale/migration.sql';

describe('correção da escala percentual dos impostos', () => {
  it('converte frações legadas de IPI e ICMS em pontos percentuais', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toMatch(/SET `ipi_rate` = `ipi_rate` \* 100/i);
    expect(migration).toMatch(/SET `icms_rate` = `icms_rate` \* 100/i);
    expect(migration.match(/AND `\w+_rate` < 1/g)).toHaveLength(2);
  });
});
