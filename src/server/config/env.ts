import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET deve possuir pelo menos 32 caracteres.'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(100).default(5),
    LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
    LOGIN_BLOCK_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),
    ORDER_PRICE_APPROVAL_VALIDITY_DAYS: z.coerce.number().int().min(1).max(365).default(7),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    EMAIL_PROVIDER: z.enum(['resend']).default('resend'),
    EMAIL_DELIVERY_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    EMAIL_API_KEY: z.string().trim().min(1).optional(),
    EMAIL_ALLOWLIST: z.string().trim().optional(),
    EMAIL_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(10_000),
    ORDER_NOTIFICATION_RECIPIENTS: z
      .string()
      .trim()
      .min(1, 'ORDER_NOTIFICATION_RECIPIENTS deve possuir ao menos um e-mail.')
      .default('nicolasbruski7@gmail.com')
      .superRefine((value, context) => {
        const recipients = value.split(',').map((item) => item.trim());
        if (recipients.some((item) => !z.string().email().safeParse(item).success)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'ORDER_NOTIFICATION_RECIPIENTS possui um e-mail inválido.',
          });
        }
      }),
    EMAIL_FROM: z
      .string()
      .trim()
      .email('EMAIL_FROM deve ser um e-mail válido.')
      .default('no-reply@localhost.invalid'),
    EMAIL_FROM_NAME: z.string().trim().min(1).max(120).optional(),
    EMAIL_REPLY_TO: z.string().trim().email('EMAIL_REPLY_TO deve ser um e-mail válido.').optional(),
  })
  .superRefine((value, context) => {
    if (!value.EMAIL_DELIVERY_ENABLED) return;
    if (!value.EMAIL_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_API_KEY'],
        message: 'EMAIL_API_KEY e obrigatoria quando EMAIL_DELIVERY_ENABLED=true.',
      });
    }
    if (value.EMAIL_FROM.endsWith('@localhost.invalid')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message: 'EMAIL_FROM deve ser um remetente autorizado quando a entrega estiver habilitada.',
      });
    }
    if (value.NODE_ENV !== 'production' && !value.EMAIL_ALLOWLIST) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_ALLOWLIST'],
        message:
          'EMAIL_ALLOWLIST e obrigatoria fora de producao quando a entrega estiver habilitada.',
      });
    }
  });

type ParsedAppConfig = z.infer<typeof environmentSchema>;
export type AppConfig = Omit<
  ParsedAppConfig,
  | 'ORDER_NOTIFICATION_RECIPIENTS'
  | 'EMAIL_FROM'
  | 'EMAIL_FROM_NAME'
  | 'EMAIL_REPLY_TO'
  | 'EMAIL_PROVIDER'
  | 'EMAIL_DELIVERY_ENABLED'
  | 'EMAIL_API_KEY'
  | 'EMAIL_ALLOWLIST'
  | 'EMAIL_POLL_INTERVAL_MS'
  | 'ORDER_PRICE_APPROVAL_VALIDITY_DAYS'
> &
  Partial<
    Pick<
      ParsedAppConfig,
      | 'ORDER_NOTIFICATION_RECIPIENTS'
      | 'EMAIL_FROM'
      | 'EMAIL_FROM_NAME'
      | 'EMAIL_REPLY_TO'
      | 'EMAIL_PROVIDER'
      | 'EMAIL_DELIVERY_ENABLED'
      | 'EMAIL_API_KEY'
      | 'EMAIL_ALLOWLIST'
      | 'EMAIL_POLL_INTERVAL_MS'
      | 'ORDER_PRICE_APPROVAL_VALIDITY_DAYS'
    >
  >;

export function parseEnvironment(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Configuração de ambiente inválida:\n${details.join('\n')}`);
  }
  return parsed.data;
}

export const config = parseEnvironment(process.env);
