import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260729130000_login_foundation/migration.sql',
);

describe('migração da fundação de Login', () => {
  it('cria todas as tabelas persistentes e vínculos exigidos pelo recorte', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    for (const table of [
      'roles',
      'permissions',
      'users',
      'role_permissions',
      'user_permission_overrides',
      'sessions',
      'login_throttles',
      'audit_logs',
    ]) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
    }
    expect(migration).toContain('UNIQUE INDEX `users_email_key` (`email`)');
    expect(migration).toContain(
      'FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE',
    );
    expect(migration).toContain('DEFAULT CHARACTER SET utf8mb4');
  });

  it('não inclui contas, senhas ou dados demonstrativos no SQL estrutural', async () => {
    const migration = (await readFile(migrationPath, 'utf8')).toLocaleLowerCase('pt-BR');

    expect(migration).not.toContain('insert into');
    expect(migration).not.toContain('samara');
    expect(migration).not.toContain('password_hash` varchar(255) not null default');
  });
});
