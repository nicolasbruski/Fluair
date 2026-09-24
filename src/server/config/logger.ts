import pino, { type Logger } from 'pino';

import type { AppConfig } from './env.js';

export function createLogger(config: Pick<AppConfig, 'LOG_LEVEL'>): Logger {
  return pino({
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.body.password',
        'res.headers.set-cookie',
        'password',
        'passwordHash',
        'sessionToken',
      ],
      censor: '[REDACTED]',
    },
  });
}
