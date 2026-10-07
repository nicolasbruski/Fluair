import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261004230000_align_seller_role_with_read_only/migration.sql',
);

describe('migração do perfil Vendedor', () => {
  it('concede o mesmo acesso estrutural do perfil Consulta', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain("`name` = 'Vendedor'");
    expect(migration).toContain("WHERE `code` = 'CALCULATION_OPERATOR'");
    expect(migration).toContain("'calculation.view', 'calculation.history'");
    expect(migration).not.toContain('calculation.export');
  });

  it('não remove concessões individuais do usuário', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).not.toMatch(/(?:DELETE|UPDATE) FROM `user_permission_overrides`/i);
  });
});
