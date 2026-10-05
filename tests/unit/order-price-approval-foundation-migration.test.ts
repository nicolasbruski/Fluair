import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260930180000_order_price_approval_foundation/migration.sql',
);
const expirationIndexMigrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260930213000_order_price_approval_expiration_index/migration.sql',
);

describe('migração da fundação de aprovação de preço', () => {
  it('é aditiva e cria estados, solicitações e itens completos', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE `order_price_approval_requests`');
    expect(migration).toContain('CREATE TABLE `order_price_approval_items`');
    expect(migration).toContain(
      "'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED', 'CONSUMED'",
    );
    expect(migration).toContain('DECIMAL(25, 4)');
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
  });

  it('protege idempotência, consumo, fila, valores e histórico', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('opar_requester_idempotency_uq');
    expect(migration).toContain('consumed_order_id_key');
    expect(migration).toContain('status_requested_at_idx');
    expect(migration).toContain('CHECK (`quantity` > 0)');
    expect(migration).toContain('CHECK (`line_number` > 0)');
    expect(migration).not.toContain('ON DELETE CASCADE');
    expect(migration.match(/ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(10);
  });

  it('mantém nomes de índices e constraints dentro do limite de 64 caracteres do MySQL', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    const identifiers = [
      ...migration.matchAll(/(?:(?:UNIQUE )?INDEX|CONSTRAINT)\s+`([^`]+)`/g),
    ].map((match) => match[1]!);

    expect(identifiers.length).toBeGreaterThan(0);
    expect(identifiers.filter((identifier) => identifier.length > 64)).toEqual([]);
  });

  it('indexa a consulta oportunista de aprovacoes vencidas sem alterar dados', async () => {
    const migration = await readFile(expirationIndexMigrationPath, 'utf8');

    expect(migration).toContain('status_approved_until_idx');
    expect(migration).toContain('(`status`, `approved_until`)');
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE|TRUNCATE)\b/im);
  });
});
