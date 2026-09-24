import argon2 from 'argon2';

import type { PasswordService } from './auth.types.js';

export const passwordService: PasswordService = {
  hash(password) {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    });
  },
  verify(hash, password) {
    return argon2.verify(hash, password);
  },
};
