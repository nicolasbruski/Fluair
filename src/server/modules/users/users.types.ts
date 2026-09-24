import type { AuditInput, PasswordService } from '../auth/auth.types.js';

export type { PasswordService };

export interface ManagedUserRecord {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: { code: string; name: string };
  rolePermissions: string[];
  permissionOverrides: Array<{ code: string; allowed: boolean }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ManagedRoleRecord {
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export type UserMutationFailure = 'not_found' | 'email_conflict' | 'role_not_found' | 'last_admin';

export type UserMutationResult =
  { outcome: 'success'; user: ManagedUserRecord } | { outcome: UserMutationFailure };

export interface CreateManagedUserInput {
  name: string;
  email: string;
  passwordHash: string;
  roleCode: string;
  commissionAccess: boolean;
  audit: AuditInput;
}

export interface UpdateManagedUserInput {
  id: string;
  name?: string;
  email?: string;
  passwordHash?: string;
  roleCode?: string;
  commissionAccess?: boolean;
  audit: AuditInput;
}

export interface SetManagedUserActiveInput {
  id: string;
  active: boolean;
  changedAt: Date;
  audit: AuditInput;
}

export interface UsersRepository {
  listUsers(): Promise<ManagedUserRecord[]>;
  listRoles(): Promise<ManagedRoleRecord[]>;
  createUser(input: CreateManagedUserInput): Promise<UserMutationResult>;
  updateUser(input: UpdateManagedUserInput): Promise<UserMutationResult>;
  setUserActive(input: SetManagedUserActiveInput): Promise<UserMutationResult>;
}
