import { createHmac, randomBytes } from 'node:crypto';

import type { AppConfig } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { ROLE_CODES, type AuthenticatedUser, type PermissionCode } from '../../../shared/auth.js';
import {
  type AccessUserRecord,
  type AuthRepository,
  type CurrentSession,
  isPermissionCode,
  type LoginContext,
  type LoginResult,
  type PasswordService,
} from './auth.types.js';

export interface AuthServiceConfig {
  secret: string;
  sessionTtlMilliseconds: number;
  loginWindowMilliseconds: number;
  loginBlockMilliseconds: number;
  loginMaxAttempts: number;
  dummyPasswordHash: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('pt-BR');
}

function effectivePermissions(user: AccessUserRecord): PermissionCode[] {
  const permissions = new Set(user.rolePermissions.filter(isPermissionCode));
  for (const override of user.permissionOverrides) {
    if (!isPermissionCode(override.code)) continue;
    if (override.allowed) permissions.add(override.code);
    else permissions.delete(override.code);
  }
  return [...permissions].sort();
}

function publicUser(user: AccessUserRecord): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    ...(user.roleCode ? { roleCode: user.roleCode } : {}),
    permissions: effectivePermissions(user),
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly passwords: PasswordService,
    private readonly config: AuthServiceConfig,
  ) {}

  private privateHash(value: string): string {
    return createHmac('sha256', this.config.secret).update(value).digest('hex');
  }

  private throttleKey(email: string, ipAddress: string): string {
    return this.privateHash(`login:${email}|${ipAddress}`);
  }

  private sessionId(token: string): string {
    return this.privateHash(`session:${token}`);
  }

  async login(emailInput: string, password: string, context: LoginContext): Promise<LoginResult> {
    const now = new Date();
    const email = normalizeEmail(emailInput);
    const throttleKey = this.throttleKey(email, context.ipAddress);
    const blockedUntil = await this.repository.getBlockedUntil(throttleKey, now);
    if (blockedUntil) {
      await this.repository.createAudit({
        actorUserId: null,
        action: 'AUTH_LOGIN_THROTTLED',
        entityType: 'session',
        entityId: null,
        metadata: { reason: 'TOO_MANY_ATTEMPTS' },
        requestId: context.requestId,
      });
      throw this.tooManyAttempts(blockedUntil, now);
    }

    const user = await this.repository.findUserByEmail(email);
    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? this.config.dummyPasswordHash,
      password,
    );

    if (!user || !passwordMatches) {
      const newlyBlockedUntil = await this.registerFailure(throttleKey, now);
      await this.repository.createAudit({
        actorUserId: user?.id ?? null,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'session',
        entityId: null,
        metadata: { reason: 'INVALID_CREDENTIALS' },
        requestId: context.requestId,
      });
      if (newlyBlockedUntil) throw this.tooManyAttempts(newlyBlockedUntil, now);
      throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }

    if (!user.active) {
      const newlyBlockedUntil = await this.registerFailure(throttleKey, now);
      await this.repository.createAudit({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_INACTIVE' },
        requestId: context.requestId,
      });
      if (newlyBlockedUntil) throw this.tooManyAttempts(newlyBlockedUntil, now);
      throw new AppError(
        403,
        'ACCOUNT_INACTIVE',
        'Sua conta está desativada. Fale com o administrador.',
      );
    }

    await this.repository.clearFailedAttempts(throttleKey);
    const sessionToken = randomBytes(32).toString('base64url');
    const id = this.sessionId(sessionToken);
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlMilliseconds);
    await this.repository.createSession({
      id,
      userId: user.id,
      expiresAt,
      ipHash: this.privateHash(`ip:${context.ipAddress}`),
      userAgent: context.userAgent?.slice(0, 255) ?? null,
    });

    try {
      await this.repository.createAudit({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_SUCCEEDED',
        entityType: 'session',
        entityId: id,
        requestId: context.requestId,
      });
    } catch (error) {
      await this.repository.revokeSession(id, now);
      throw error;
    }

    return { user: publicUser(user), sessionToken, expiresAt };
  }

  async getCurrentSession(sessionToken: string | undefined): Promise<CurrentSession> {
    if (!sessionToken) throw new AppError(401, 'AUTH_REQUIRED', 'Sua sessão não está autenticada.');
    const now = new Date();
    const session = await this.repository.findSession(this.sessionId(sessionToken), now);
    if (!session)
      throw new AppError(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.');
    if (!session.active) {
      await this.repository.revokeSession(session.sessionId, now);
      throw new AppError(401, 'ACCOUNT_INACTIVE', 'Sua conta está desativada.');
    }
    await this.repository.touchSession(session.sessionId, now);
    return {
      user: publicUser(session),
      sessionId: session.sessionId,
      expiresAt: session.sessionExpiresAt,
    };
  }

  async requirePermission(
    sessionToken: string | undefined,
    permission: PermissionCode,
    requestId: string,
  ): Promise<AuthenticatedUser> {
    const session = await this.getCurrentSession(sessionToken);
    if (session.user.permissions.includes(permission)) return session.user;
    await this.repository.createAudit({
      actorUserId: session.user.id,
      action: 'AUTH_PERMISSION_DENIED',
      entityType: 'permission',
      entityId: permission,
      requestId,
    });
    throw new AppError(403, 'PERMISSION_DENIED', 'Você não possui acesso a esta área.');
  }

  async requireAnyPermission(
    sessionToken: string | undefined,
    permissions: PermissionCode[],
    requestId: string,
  ): Promise<AuthenticatedUser> {
    const session = await this.getCurrentSession(sessionToken);
    if (permissions.some((permission) => session.user.permissions.includes(permission))) {
      return session.user;
    }
    await this.repository.createAudit({
      actorUserId: session.user.id,
      action: 'AUTH_PERMISSION_DENIED',
      entityType: 'permission',
      entityId: permissions.join(','),
      requestId,
    });
    throw new AppError(403, 'PERMISSION_DENIED', 'Você não possui acesso a esta área.');
  }

  async requireAdministrator(
    sessionToken: string | undefined,
    requestId: string,
  ): Promise<AuthenticatedUser> {
    const session = await this.getCurrentSession(sessionToken);
    if (session.user.roleCode === ROLE_CODES.administrator) return session.user;
    await this.repository.createAudit({
      actorUserId: session.user.id,
      action: 'AUTH_ROLE_DENIED',
      entityType: 'role',
      entityId: ROLE_CODES.administrator,
      requestId,
    });
    throw new AppError(403, 'ROLE_DENIED', 'Somente administradores podem realizar esta ação.');
  }

  async logout(sessionToken: string | undefined, requestId: string): Promise<void> {
    if (!sessionToken) return;
    const now = new Date();
    const id = this.sessionId(sessionToken);
    const session = await this.repository.findSession(id, now);
    await this.repository.revokeSession(id, now);
    if (session) {
      await this.repository.createAudit({
        actorUserId: session.id,
        action: 'AUTH_LOGOUT',
        entityType: 'session',
        entityId: id,
        requestId,
      });
    }
  }

  private registerFailure(key: string, now: Date): Promise<Date | null> {
    return this.repository.recordFailedAttempt({
      key,
      now,
      windowMilliseconds: this.config.loginWindowMilliseconds,
      blockMilliseconds: this.config.loginBlockMilliseconds,
      maxAttempts: this.config.loginMaxAttempts,
    });
  }

  private tooManyAttempts(blockedUntil: Date, now: Date): AppError {
    const retryAfter = Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1_000));
    return new AppError(
      429,
      'TOO_MANY_ATTEMPTS',
      'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
      {},
      { 'Retry-After': String(retryAfter) },
    );
  }
}

export function authServiceConfig(
  config: Pick<
    AppConfig,
    | 'SESSION_SECRET'
    | 'SESSION_TTL_HOURS'
    | 'LOGIN_WINDOW_MINUTES'
    | 'LOGIN_BLOCK_MINUTES'
    | 'LOGIN_MAX_ATTEMPTS'
  >,
  dummyPasswordHash: string,
): AuthServiceConfig {
  return {
    secret: config.SESSION_SECRET,
    sessionTtlMilliseconds: config.SESSION_TTL_HOURS * 60 * 60 * 1_000,
    loginWindowMilliseconds: config.LOGIN_WINDOW_MINUTES * 60 * 1_000,
    loginBlockMilliseconds: config.LOGIN_BLOCK_MINUTES * 60 * 1_000,
    loginMaxAttempts: config.LOGIN_MAX_ATTEMPTS,
    dummyPasswordHash,
  };
}
