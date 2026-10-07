import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261005180000_grant_order_access_to_all_roles/migration.sql',
);

describe('migração do acesso de todos os perfis a Pedidos', () => {
  it('concede o conjunto comercial aos três perfis', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    for (const role of ['ADMINISTRATOR', 'CALCULATION_OPERATOR', 'READ_ONLY']) {
      expect(migration).toContain(`'${role}'`);
    }
    for (const permission of ['order.access', 'price.view', 'price.override', 'customer.view']) {
      expect(migration).toContain(`'${permission}'`);
    }
  });

  it('não concede a decisão administrativa', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).not.toContain("'order.price-approval.manage'");
  });
});
