import { PERMISSIONS, type AuthenticatedUser, type PermissionCode } from '../../../shared/auth.js';

export interface AccessUserRecord {
  id: string;
  name: string;
  email: string;
  roleCode?: string;
  passwordHash: string;
  active: boolean;
  rolePermissions: string[];
  permissionOverrides: Array<{ code: string; allowed: boolean }>;
}

export interface SessionUserRecord extends AccessUserRecord {
  sessionId: string;
  sessionExpiresAt: Date;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  expiresAt: Date;
  ipHash: string;
  userAgent: string | null;
}

export interface AuditInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  requestId: string;
}

export interface FailedAttemptInput {
  key: string;
  now: Date;
  windowMilliseconds: number;
  blockMilliseconds: number;
  maxAttempts: number;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AccessUserRecord | null>;
  findSession(id: string, now: Date): Promise<SessionUserRecord | null>;
  createSession(input: CreateSessionInput): Promise<void>;
  touchSession(id: string, now: Date): Promise<void>;
  revokeSession(id: string, now: Date): Promise<void>;
  getBlockedUntil(key: string, now: Date): Promise<Date | null>;
  recordFailedAttempt(input: FailedAttemptInput): Promise<Date | null>;
  clearFailedAttempts(key: string): Promise<void>;
  createAudit(input: AuditInput): Promise<void>;
}

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

export interface LoginContext {
  ipAddress: string;
  userAgent: string | null;
  requestId: string;
}

export interface LoginResult {
  user: AuthenticatedUser;
  sessionToken: string;
  expiresAt: Date;
}

export interface CurrentSession {
  user: AuthenticatedUser;
  sessionId: string;
  expiresAt: Date;
}

const permissionCodes = new Set<string>(PERMISSIONS);

export function isPermissionCode(code: string): code is PermissionCode {
  return permissionCodes.has(code);
}
