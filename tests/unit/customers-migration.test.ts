import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('migração dos clientes legados', () => {
  it('leva os 1.507 códigos únicos do HTML de origem para a migração do banco', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'Comissoes/sistema_comissao_v3.html'),
      'utf8',
    );
    const migration = await readFile(
      resolve(process.cwd(), 'prisma/migrations/20260802183000_customers/migration.sql'),
      'utf8',
    );
    const migratedCodes = [...migration.matchAll(/\(UUID\(\), '([^']+)',/g)].map(
      (match) => match[1],
    );

    expect(migratedCodes).toHaveLength(1507);
    expect(new Set(migratedCodes).size).toBe(1507);
    expect(migratedCodes).toEqual(expect.arrayContaining(['C01619', 'C00722', 'C01799']));
    expect(source).not.toContain('const INIT_DB=');
    expect(source).toContain("apiRequest('/api/v1/commissions/customers')");
  });
});
