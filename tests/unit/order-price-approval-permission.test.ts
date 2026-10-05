import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '../../src/shared/auth.js';

describe('permissão de aprovação de preço', () => {
  it('faz parte do contrato e do papel Administrador sem remover overrides individuais', async () => {
    const seed = await readFile(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

    expect(PERMISSIONS).toContain('order.price-approval.manage');
    expect(seed).toContain("'order.price-approval.manage':");
    expect(seed).toContain(
      "permissions: PERMISSIONS.filter((code) => code !== 'commission.access')",
    );
    expect(seed).not.toContain('userPermissionOverride.deleteMany');
  });
});
