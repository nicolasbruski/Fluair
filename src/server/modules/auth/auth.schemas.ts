import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z
      .string({ required_error: 'Informe o e-mail.' })
      .trim()
      .min(1, 'Informe o e-mail.')
      .max(254, 'O e-mail é muito longo.')
      .email('Informe um e-mail válido.')
      .transform((email) => email.toLocaleLowerCase('pt-BR')),
    password: z
      .string({ required_error: 'Informe a senha.' })
      .min(1, 'Informe a senha.')
      .max(256, 'A senha é muito longa.'),
  })
  .strict();
