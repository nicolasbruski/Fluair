import { Prisma, type PrismaClient } from '@prisma/client';

import { ROLE_CODES } from '../../../shared/auth.js';
import type { AuditInput } from '../auth/auth.types.js';
import type {
  CreateManagedUserInput,
  ManagedRoleRecord,
  ManagedUserRecord,
  SetManagedUserActiveInput,
  UpdateManagedUserInput,
  UserMutationResult,
  UsersRepository,
} from './users.types.js';

const managedUserInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  permissionOverrides: { include: { permission: true } },
} satisfies Prisma.UserInclude;

const COMMISSION_PERMISSION = 'commission.access';

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof managedUserInclude }>;

function mapUser(user: UserWithAccess): ManagedUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    role: { code: user.role.code, name: user.role.name },
    rolePermissions: user.role.permissions.map((item) => item.permission.code),
    permissionOverrides: user.permissionOverrides.map((item) => ({
      code: item.permission.code,
      allowed: item.allowed,
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function auditData(audit: AuditInput, entityId: string, metadata?: AuditInput['metadata']) {
  return {
    actorUserId: audit.actorUserId,
    action: audit.action,
    entityType: audit.entityType,
    entityId,
    requestId: audit.requestId,
    ...(metadata ? { metadata } : audit.metadata ? { metadata: audit.metadata } : {}),
  };
}

function emailConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listUsers(): Promise<ManagedUserRecord[]> {
    const users = await this.prisma.user.findMany({
      include: managedUserInclude,
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { email: 'asc' }],
    });
    return users.map(mapUser);
  }

  async listRoles(): Promise<ManagedRoleRecord[]> {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
    return roles.map((role) => ({
      code: role.code,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((item) => item.permission.code),
    }));
  }

  async createUser(input: CreateManagedUserInput): Promise<UserMutationResult> {
    try {
      return await this.prisma.$transaction(
        async (transaction): Promise<UserMutationResult> => {
          const role = await transaction.role.findUnique({ where: { code: input.roleCode } });
          if (!role) return { outcome: 'role_not_found' };
          const commissionPermission = input.commissionAccess
            ? await transaction.permission.findUniqueOrThrow({
                where: { code: COMMISSION_PERMISSION },
              })
            : null;
          const user = await transaction.user.create({
            data: {
              name: input.name,
              email: input.email,
              passwordHash: input.passwordHash,
              roleId: role.id,
              active: true,
              ...(commissionPermission
                ? {
                    permissionOverrides: {
                      create: {
                        permissionId: commissionPermission.id,
                        allowed: true,
                      },
                    },
                  }
                : {}),
            },
            include: managedUserInclude,
          });
          await transaction.auditLog.create({
            data: auditData(input.audit, user.id, {
              ...input.audit.metadata,
              roleCode: input.roleCode,
            }),
          });
          return { outcome: 'success', user: mapUser(user) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (emailConflict(error)) return { outcome: 'email_conflict' };
      throw error;
    }
  }

  async updateUser(input: UpdateManagedUserInput): Promise<UserMutationResult> {
    try {
      return await this.prisma.$transaction(
        async (transaction): Promise<UserMutationResult> => {
          const current = await transaction.user.findUnique({
            where: { id: input.id },
            include: managedUserInclude,
          });
          if (!current) return { outcome: 'not_found' };

          let roleId: string | undefined;
          let nextRoleCode = current.role.code;
          if (input.roleCode !== undefined) {
            const role = await transaction.role.findUnique({ where: { code: input.roleCode } });
            if (!role) return { outcome: 'role_not_found' };
            roleId = role.id;
            nextRoleCode = role.code;
          }

          const removesActiveAdministrator =
            current.active &&
            current.role.code === ROLE_CODES.administrator &&
            nextRoleCode !== ROLE_CODES.administrator;
          if (removesActiveAdministrator) {
            const otherAdministrators = await transaction.user.count({
              where: {
                id: { not: current.id },
                active: true,
                role: { code: ROLE_CODES.administrator },
              },
            });
            if (otherAdministrators === 0) return { outcome: 'last_admin' };
          }

          await transaction.user.update({
            where: { id: input.id },
            data: {
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.email !== undefined ? { email: input.email } : {}),
              ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
              ...(roleId !== undefined ? { roleId } : {}),
            },
          });

          if (input.commissionAccess !== undefined) {
            const permission = await transaction.permission.findUniqueOrThrow({
              where: { code: COMMISSION_PERMISSION },
            });
            await transaction.userPermissionOverride.upsert({
              where: {
                userId_permissionId: { userId: input.id, permissionId: permission.id },
              },
              update: { allowed: input.commissionAccess },
              create: {
                userId: input.id,
                permissionId: permission.id,
                allowed: input.commissionAccess,
              },
            });
          }

          const user = await transaction.user.findUniqueOrThrow({
            where: { id: input.id },
            include: managedUserInclude,
          });
          await transaction.auditLog.create({
            data: auditData(input.audit, user.id, {
              ...input.audit.metadata,
              previousRoleCode: current.role.code,
              newRoleCode: user.role.code,
            }),
          });
          return { outcome: 'success', user: mapUser(user) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (emailConflict(error)) return { outcome: 'email_conflict' };
      throw error;
    }
  }

  async setUserActive(input: SetManagedUserActiveInput): Promise<UserMutationResult> {
    return this.prisma.$transaction(
      async (transaction): Promise<UserMutationResult> => {
        const current = await transaction.user.findUnique({
          where: { id: input.id },
          include: managedUserInclude,
        });
        if (!current) return { outcome: 'not_found' };
        if (current.active === input.active) return { outcome: 'success', user: mapUser(current) };

        if (!input.active && current.active && current.role.code === ROLE_CODES.administrator) {
          const otherAdministrators = await transaction.user.count({
            where: {
              id: { not: current.id },
              active: true,
              role: { code: ROLE_CODES.administrator },
            },
          });
          if (otherAdministrators === 0) return { outcome: 'last_admin' };
        }

        const user = await transaction.user.update({
          where: { id: input.id },
          data: { active: input.active },
          include: managedUserInclude,
        });
        if (!input.active) {
          await transaction.session.updateMany({
            where: { userId: input.id, revokedAt: null },
            data: { revokedAt: input.changedAt },
          });
        }
        await transaction.auditLog.create({
          data: auditData(input.audit, user.id, { active: input.active }),
        });
        return { outcome: 'success', user: mapUser(user) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
