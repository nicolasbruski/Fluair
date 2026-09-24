import { z } from 'zod';

const name = z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres.').max(120);
const email = z.string().trim().email('Informe um e-mail válido.').max(254);
const password = z.string().min(8, 'A senha deve possuir pelo menos 8 caracteres.').max(256);
const roleCode = z.string().trim().min(1, 'Selecione um perfil.').max(64);

export const userIdSchema = z.object({ id: z.string().uuid('Usuário inválido.') });

export const createUserSchema = z
  .object({ name, email, password, roleCode, commissionAccess: z.boolean().default(false) })
  .strict();

export const updateUserSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    roleCode: roleCode.optional(),
    commissionAccess: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Informe ao menos uma alteração.',
  });
