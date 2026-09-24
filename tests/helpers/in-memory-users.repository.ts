import { ROLE_CODES } from '../../src/shared/auth.js';
import type { AuditInput } from '../../src/server/modules/auth/auth.types.js';
import type {
  CreateManagedUserInput,
  ManagedRoleRecord,
  ManagedUserRecord,
  SetManagedUserActiveInput,
  UpdateManagedUserInput,
  UserMutationResult,
  UsersRepository,
} from '../../src/server/modules/users/users.types.js';

const now = new Date('2026-08-02T12:00:00.000Z');

export const managedRoles: ManagedRoleRecord[] = [
  {
    code: ROLE_CODES.administrator,
    name: 'Administrador',
    description: 'Acesso total.',
    permissions: ['user.view', 'user.manage', 'calculation.view'],
  },
  {
    code: ROLE_CODES.calculationOperator,
    name: 'Operador de cálculo',
    description: 'Calcula e consulta.',
    permissions: ['calculation.view', 'calculation.create'],
  },
];

export const managedAdministrator: ManagedUserRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora',
  email: 'admin@fluair.test',
  active: true,
  role: { code: ROLE_CODES.administrator, name: 'Administrador' },
  rolePermissions: ['user.view', 'user.manage', 'calculation.view'],
  permissionOverrides: [],
  createdAt: now,
  updatedAt: now,
};

export class InMemoryUsersRepository implements UsersRepository {
  readonly users = new Map<string, ManagedUserRecord>();
  readonly passwordHashes = new Map<string, string>();
  readonly audits: AuditInput[] = [];

  constructor() {
    this.addUser(managedAdministrator);
  }

  addUser(user: ManagedUserRecord): void {
    this.users.set(user.id, structuredClone(user));
  }

  async listUsers(): Promise<ManagedUserRecord[]> {
    return structuredClone([...this.users.values()]);
  }

  async listRoles(): Promise<ManagedRoleRecord[]> {
    return structuredClone(managedRoles);
  }

  async createUser(input: CreateManagedUserInput): Promise<UserMutationResult> {
    if (this.findByEmail(input.email)) return { outcome: 'email_conflict' };
    const role = managedRoles.find((item) => item.code === input.roleCode);
    if (!role) return { outcome: 'role_not_found' };
    const id = `00000000-0000-4000-8000-${String(this.users.size + 1).padStart(12, '0')}`;
    const user: ManagedUserRecord = {
      id,
      name: input.name,
      email: input.email,
      active: true,
      role: { code: role.code, name: role.name },
      rolePermissions: [...role.permissions],
      permissionOverrides: input.commissionAccess
        ? [{ code: 'commission.access', allowed: true }]
        : [],
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, structuredClone(user));
    this.passwordHashes.set(id, input.passwordHash);
    this.audits.push({ ...structuredClone(input.audit), entityId: id });
    return { outcome: 'success', user: structuredClone(user) };
  }

  async updateUser(input: UpdateManagedUserInput): Promise<UserMutationResult> {
    const current = this.users.get(input.id);
    if (!current) return { outcome: 'not_found' };
    if (input.email && this.findByEmail(input.email, input.id))
      return { outcome: 'email_conflict' };
    const role = input.roleCode
      ? managedRoles.find((item) => item.code === input.roleCode)
      : undefined;
    if (input.roleCode && !role) return { outcome: 'role_not_found' };
    if (
      current.active &&
      current.role.code === ROLE_CODES.administrator &&
      role &&
      role.code !== ROLE_CODES.administrator &&
      this.activeAdministrators(input.id) === 0
    ) {
      return { outcome: 'last_admin' };
    }
    const updated: ManagedUserRecord = {
      ...current,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(role
        ? {
            role: { code: role.code, name: role.name },
            rolePermissions: [...role.permissions],
          }
        : {}),
      ...(input.commissionAccess !== undefined
        ? {
            permissionOverrides: [
              ...current.permissionOverrides.filter(
                (override) => override.code !== 'commission.access',
              ),
              { code: 'commission.access', allowed: input.commissionAccess },
            ],
          }
        : {}),
      updatedAt: now,
    };
    this.users.set(input.id, structuredClone(updated));
    if (input.passwordHash) this.passwordHashes.set(input.id, input.passwordHash);
    this.audits.push(structuredClone(input.audit));
    return { outcome: 'success', user: structuredClone(updated) };
  }

  async setUserActive(input: SetManagedUserActiveInput): Promise<UserMutationResult> {
    const current = this.users.get(input.id);
    if (!current) return { outcome: 'not_found' };
    if (
      !input.active &&
      current.active &&
      current.role.code === ROLE_CODES.administrator &&
      this.activeAdministrators(input.id) === 0
    ) {
      return { outcome: 'last_admin' };
    }
    const updated = { ...current, active: input.active, updatedAt: input.changedAt };
    this.users.set(input.id, structuredClone(updated));
    this.audits.push(structuredClone(input.audit));
    return { outcome: 'success', user: structuredClone(updated) };
  }

  private findByEmail(email: string, exceptId?: string): ManagedUserRecord | undefined {
    return [...this.users.values()].find(
      (user) => user.email === email && (exceptId === undefined || user.id !== exceptId),
    );
  }

  private activeAdministrators(exceptId: string): number {
    return [...this.users.values()].filter(
      (user) => user.id !== exceptId && user.active && user.role.code === ROLE_CODES.administrator,
    ).length;
  }
}
