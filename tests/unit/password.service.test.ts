import argon2 from 'argon2';
import { describe, expect, it } from 'vitest';

import { passwordService } from '../../src/server/modules/auth/password.service.js';

describe('passwordService', () => {
  it('gera hash Argon2id e verifica somente a senha correta', async () => {
    const password = 'senha-forte-de-teste';
    const hash = await passwordService.hash(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
    expect(await passwordService.verify(hash, password)).toBe(true);
    expect(await passwordService.verify(hash, 'senha-incorreta')).toBe(false);

    const parsed = argon2.needsRehash(hash, {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    expect(parsed).toBe(false);
  });
});
