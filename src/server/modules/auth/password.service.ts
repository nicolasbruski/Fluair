import { randomBytes } from 'node:crypto';

import { argon2id, argon2Verify } from 'hash-wasm';

import type { PasswordService } from './auth.types.js';

export const passwordService: PasswordService = {
  hash(password) {
    return argon2id({
      password,
      salt: randomBytes(16),
      memorySize: 19_456,
      iterations: 2,
      parallelism: 1,
      hashLength: 32,
      outputType: 'encoded',
    });
  },
  verify(hash, password) {
    return argon2Verify({ hash, password });
  },
};
