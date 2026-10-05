import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20261002150000_single_order_draft/migration.sql',
);

describe('migração do pedido anterior salvo', () => {
  it('cria um único slot por usuário sem remover dados existentes', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `order_drafts`');
    expect(migration).toContain('UNIQUE INDEX `order_drafts_user_id_key` (`user_id`)');
    expect(migration).toContain('`payload` JSON NOT NULL');
    expect(migration).toContain('order_drafts_user_id_fkey');
    expect(migration).toContain('order_drafts_customer_id_fkey');
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
  });
});
