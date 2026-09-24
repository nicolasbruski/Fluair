import type {
  AccessUserRecord,
  AuditInput,
  AuthRepository,
  CreateSessionInput,
  FailedAttemptInput,
  PasswordService,
  SessionUserRecord,
} from '../../src/server/modules/auth/auth.types.js';

interface StoredThrottle {
  attempts: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
}

export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, AccessUserRecord>();
  readonly sessions = new Map<string, CreateSessionInput & { revokedAt: Date | null }>();
  readonly throttles = new Map<string, StoredThrottle>();
  readonly audits: AuditInput[] = [];

  addUser(user: AccessUserRecord): void {
    this.users.set(user.email, structuredClone(user));
  }

  async findUserByEmail(email: string): Promise<AccessUserRecord | null> {
    return structuredClone(this.users.get(email) ?? null);
  }

  async findSession(id: string, now: Date): Promise<SessionUserRecord | null> {
    const session = this.sessions.get(id);
    if (!session || session.revokedAt || session.expiresAt <= now) return null;
    const user = [...this.users.values()].find((candidate) => candidate.id === session.userId);
    return user
      ? { ...structuredClone(user), sessionId: session.id, sessionExpiresAt: session.expiresAt }
      : null;
  }

  async createSession(input: CreateSessionInput): Promise<void> {
    this.sessions.set(input.id, { ...input, revokedAt: null });
  }

  async touchSession(_id: string, _now: Date): Promise<void> {}

  async revokeSession(id: string, now: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) session.revokedAt = now;
  }

  async getBlockedUntil(key: string, now: Date): Promise<Date | null> {
    const blockedUntil = this.throttles.get(key)?.blockedUntil;
    return blockedUntil && blockedUntil > now ? blockedUntil : null;
  }

  async recordFailedAttempt(input: FailedAttemptInput): Promise<Date | null> {
    const current = this.throttles.get(input.key);
    if (current?.blockedUntil && current.blockedUntil > input.now) return current.blockedUntil;
    const expired =
      !current ||
      input.now.getTime() - current.windowStartedAt.getTime() >= input.windowMilliseconds;
    const attempts = expired ? 1 : current.attempts + 1;
    const blockedUntil =
      attempts >= input.maxAttempts
        ? new Date(input.now.getTime() + input.blockMilliseconds)
        : null;
    this.throttles.set(input.key, {
      attempts,
      windowStartedAt: expired ? input.now : current.windowStartedAt,
      blockedUntil,
    });
    return blockedUntil;
  }

  async clearFailedAttempts(key: string): Promise<void> {
    this.throttles.delete(key);
  }

  async createAudit(input: AuditInput): Promise<void> {
    this.audits.push(structuredClone(input));
  }
}

export const fakePasswordService: PasswordService = {
  async hash(password) {
    return `hash:${password}`;
  },
  async verify(hash, password) {
    return hash === `hash:${password}`;
  },
};

export const activeUser: AccessUserRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Usuária de Teste',
  email: 'usuario@fluair.test',
  passwordHash: 'hash:senha-correta',
  active: true,
  rolePermissions: ['calculation.view', 'calculation.export'],
  permissionOverrides: [
    { code: 'calculation.export', allowed: false },
    { code: 'matrix.view', allowed: true },
  ],
};
