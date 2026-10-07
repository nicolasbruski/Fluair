import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve('prisma/migrations/20261006120000_multiple_order_drafts/migration.sql'),
  'utf8',
);

describe('migração da fila de pedidos em andamento', () => {
  it('troca a unicidade por usuário pela unicidade entre usuário e cliente', () => {
    expect(migration).toContain('DROP INDEX `order_drafts_user_id_key`');
    expect(migration).toContain('order_drafts_user_id_customer_id_key');
    expect(migration).toContain('(`user_id`, `customer_id`)');
    expect(migration).toContain('order_drafts_user_id_updated_at_idx');
    expect(migration.indexOf('order_drafts_user_id_customer_id_key')).toBeLessThan(
      migration.indexOf('DROP INDEX `order_drafts_user_id_key`'),
    );
  });
});
