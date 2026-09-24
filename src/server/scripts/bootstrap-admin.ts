import 'dotenv/config';

import { z } from 'zod';

import { Prisma } from '@prisma/client';

import { ROLE_CODES } from '../../shared/auth.js';
import { prisma } from '../database/prisma.js';
import { normalizeEmail } from '../modules/auth/auth.service.js';
import { passwordService } from '../modules/auth/password.service.js';

const inputSchema = z.object({
  ADMIN_NAME: z.string().trim().min(2).max(120),
  ADMIN_EMAIL: z.string().trim().email().max(254),
  ADMIN_PASSWORD: z.string().min(8).max(256),
});

async function main(): Promise<void> {
  const input = inputSchema.parse(process.env);
  process.env.ADMIN_PASSWORD = '';
  const email = normalizeEmail(input.ADMIN_EMAIL);
  const role = await prisma.role.findUnique({ where: { code: ROLE_CODES.administrator } });
  if (!role) throw new Error('Papel Administrador ausente. Execute `npm run db:seed` primeiro.');

  const passwordHash = await passwordService.hash(input.ADMIN_PASSWORD);
  const user = await prisma.$transaction(
    async (transaction) => {
      const activeAdministrator = await transaction.user.findFirst({
        where: { roleId: role.id, active: true },
        select: { id: true },
      });
      if (activeAdministrator) {
        throw new Error('Já existe um administrador ativo. O bootstrap só cria a primeira conta.');
      }
      const existing = await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) throw new Error('Já existe uma conta com o e-mail informado.');

      const created = await transaction.user.create({
        data: { name: input.ADMIN_NAME, email, passwordHash, roleId: role.id, active: true },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId: created.id,
          action: 'ADMIN_BOOTSTRAPPED',
          entityType: 'user',
          entityId: created.id,
          requestId: 'bootstrap-admin',
        },
      });
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  console.info(`Administrador criado: ${user.name} <${user.email}>`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
