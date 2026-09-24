import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  AccessUserRecord,
  AuditInput,
  AuthRepository,
  CreateSessionInput,
  FailedAttemptInput,
  SessionUserRecord,
} from './auth.types.js';

const accessInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
  permissionOverrides: { include: { permission: true } },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{ include: typeof accessInclude }>;

function mapUser(user: UserWithAccess): AccessUserRecord {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleCode: user.role.code,
    passwordHash: user.passwordHash,
    active: user.active,
    rolePermissions: user.role.permissions.map((item) => item.permission.code),
    permissionOverrides: user.permissionOverrides.map((item) => ({
      code: item.permission.code,
      allowed: item.allowed,
    })),
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AccessUserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: accessInclude });
    return user ? mapUser(user) : null;
  }

  async findSession(id: string, now: Date): Promise<SessionUserRecord | null> {
    const session = await this.prisma.session.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: now } },
      include: { user: { include: accessInclude } },
    });
    if (!session) return null;
    return {
      ...mapUser(session.user),
      sessionId: session.id,
      sessionExpiresAt: session.expiresAt,
    };
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    await this.prisma.session.create({ data: input });
  }

  async touchSession(id: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { lastSeenAt: now },
    });
  }

  async revokeSession(id: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async getBlockedUntil(key: string, now: Date): Promise<Date | null> {
    const throttle = await this.prisma.loginThrottle.findUnique({ where: { key } });
    return throttle?.blockedUntil && throttle.blockedUntil > now ? throttle.blockedUntil : null;
  }

  async recordFailedAttempt(input: FailedAttemptInput): Promise<Date | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.loginThrottle.findUnique({ where: { key: input.key } });
        if (current?.blockedUntil && current.blockedUntil > input.now) return current.blockedUntil;

        const windowExpired =
          !current ||
          input.now.getTime() - current.windowStartedAt.getTime() >= input.windowMilliseconds;
        const attempts = windowExpired ? 1 : current.attempts + 1;
        const blockedUntil =
          attempts >= input.maxAttempts
            ? new Date(input.now.getTime() + input.blockMilliseconds)
            : null;

        await transaction.loginThrottle.upsert({
          where: { key: input.key },
          create: {
            key: input.key,
            attempts,
            windowStartedAt: input.now,
            blockedUntil,
          },
          update: {
            attempts,
            windowStartedAt: windowExpired ? input.now : current.windowStartedAt,
            blockedUntil,
          },
        });
        return blockedUntil;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async clearFailedAttempts(key: string): Promise<void> {
    await this.prisma.loginThrottle.deleteMany({ where: { key } });
  }

  async createAudit(input: AuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        requestId: input.requestId,
      },
    });
  }
}
