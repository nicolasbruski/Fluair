import { describe, expect, it } from 'vitest';

import { passwordService } from '../../src/server/modules/auth/password.service.js';

describe('passwordService', () => {
  it('gera hash Argon2id e verifica somente a senha correta', async () => {
    const password = 'senha-forte-de-teste';
    const hash = await passwordService.hash(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain(password);
    expect(await passwordService.verify(hash, password)).toBe(true);
    expect(await passwordService.verify(hash, 'senha-incorreta')).toBe(false);
  });
});
