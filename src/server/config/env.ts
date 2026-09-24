import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve possuir pelo menos 32 caracteres.'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(100).default(5),
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
  LOGIN_BLOCK_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Configuração de ambiente inválida:\n${details.join('\n')}`);
  }
  return parsed.data;
}

export const config = parseEnvironment(process.env);
