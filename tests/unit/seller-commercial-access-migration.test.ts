import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261004233000_expand_seller_commercial_access/migration.sql',
);

describe('migração do acesso comercial do Vendedor', () => {
  it('libera Busca, Pedidos, Produtos e Clientes', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    for (const permission of [
      'calculation.view',
      'calculation.history',
      'calculation.export',
      'order.access',
      'price.view',
      'price.override',
      'customer.view',
    ]) {
      expect(migration).toContain(`'${permission}'`);
    }
  });

  it('não concede permissões administrativas', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    for (const permission of [
      'calculation.create',
      'matrix.manage',
      'customer.manage',
      'catalog.manage',
      'user.manage',
      'order.price-approval.manage',
    ]) {
      expect(migration).not.toContain(`'${permission}'`);
    }
  });
});
