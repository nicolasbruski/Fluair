import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260929140000_orders_foundation/migration.sql',
);

describe('migração da fundação de pedidos', () => {
  it('cria pedido, itens, entrega e sequência sem alterar dados existentes', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `orders`');
    expect(migration).toContain('CREATE TABLE `order_items`');
    expect(migration).toContain('CREATE TABLE `order_email_deliveries`');
    expect(migration).toContain('CREATE TABLE `order_number_sequences`');
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
  });

  it('protege unicidade, valores, histórico e busca do worker', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('orders_number_key');
    expect(migration).toContain('orders_created_by_user_id_idempotency_key_key');
    expect(migration).toContain('order_email_deliveries_idempotency_key_key');
    expect(migration).toContain('order_email_deliveries_status_next_attempt_at_idx');
    expect(migration).toContain('order_email_deliveries_status_reservation_expires_at_idx');
    expect(migration).toContain('CHECK (`quantity` > 0)');
    expect(migration).toContain('CHECK (`negotiated_unit_price` >= 0)');
    expect(migration).not.toContain('ON DELETE CASCADE');
  });
});
