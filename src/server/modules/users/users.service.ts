import type { AuthenticatedUser, PermissionCode } from '../../../shared/auth.js';
import type { ManagedRole, ManagedUser, UsersEnvelope } from '../../../shared/users.js';
import { AppError } from '../../errors/app-error.js';
import { normalizeEmail } from '../auth/auth.service.js';
import { isPermissionCode } from '../auth/auth.types.js';
import type {
  ManagedRoleRecord,
  ManagedUserRecord,
  PasswordService,
  UserMutationResult,
  UsersRepository,
} from './users.types.js';

export interface CreateUserCommand {
  name: string;
  email: string;
  password: string;
  roleCode: string;
  commissionAccess?: boolean | undefined;
}

export interface UpdateUserCommand {
  name?: string | undefined;
  email?: string | undefined;
  password?: string | undefined;
  roleCode?: string | undefined;
  commissionAccess?: boolean | undefined;
}

export interface UserMutationContext {
  actor: AuthenticatedUser;
  requestId: string;
}

function permissions(record: {
  rolePermissions: string[];
  permissionOverrides: Array<{ code: string; allowed: boolean }>;
}): PermissionCode[] {
  const effective = new Set(record.rolePermissions.filter(isPermissionCode));
  for (const override of record.permissionOverrides) {
    if (!isPermissionCode(override.code)) continue;
    if (override.allowed) effective.add(override.code);
    else effective.delete(override.code);
  }
  return [...effective].sort();
}

function publicUser(user: ManagedUserRecord): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    role: user.role,
    permissions: permissions(user),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function publicRole(role: ManagedRoleRecord): ManagedRole {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: role.permissions.filter(isPermissionCode).sort(),
  };
}

function mutationError(result: Exclude<UserMutationResult, { outcome: 'success' }>): AppError {
  switch (result.outcome) {
    case 'not_found':
      return new AppError(404, 'USER_NOT_FOUND', 'Usuário não encontrado.');
    case 'email_conflict':
      return new AppError(409, 'EMAIL_ALREADY_USED', 'Já existe uma conta com este e-mail.', {
        email: ['Este e-mail já está sendo utilizado.'],
      });
    case 'role_not_found':
      return new AppError(400, 'ROLE_NOT_FOUND', 'O perfil selecionado não existe.', {
        roleCode: ['Selecione um perfil válido.'],
      });
    case 'last_admin':
      return new AppError(
        409,
        'LAST_ACTIVE_ADMIN',
        'O sistema precisa manter pelo menos um administrador ativo.',
      );
  }
}

export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly passwords: PasswordService,
  ) {}

  async list(): Promise<UsersEnvelope> {
    const [users, roles] = await Promise.all([
      this.repository.listUsers(),
      this.repository.listRoles(),
    ]);
    return {
      data: {
        users: users.map(publicUser),
        roles: roles.map(publicRole),
      },
    };
  }

  async create(command: CreateUserCommand, context: UserMutationContext): Promise<ManagedUser> {
    const result = await this.repository.createUser({
      name: command.name.trim(),
      email: normalizeEmail(command.email),
      passwordHash: await this.passwords.hash(command.password),
      roleCode: command.roleCode,
      commissionAccess: Boolean(command.commissionAccess),
      audit: {
        actorUserId: context.actor.id,
        action: 'USER_CREATED',
        entityType: 'user',
        entityId: null,
        metadata: {
          roleCode: command.roleCode,
          commissionAccess: Boolean(command.commissionAccess),
        },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return publicUser(result.user);
  }

  async update(
    id: string,
    command: UpdateUserCommand,
    context: UserMutationContext,
  ): Promise<ManagedUser> {
    const passwordHash = command.password ? await this.passwords.hash(command.password) : undefined;
    const result = await this.repository.updateUser({
      id,
      ...(command.name !== undefined ? { name: command.name.trim() } : {}),
      ...(command.email !== undefined ? { email: normalizeEmail(command.email) } : {}),
      ...(passwordHash !== undefined ? { passwordHash } : {}),
      ...(command.roleCode !== undefined ? { roleCode: command.roleCode } : {}),
      ...(command.commissionAccess !== undefined
        ? { commissionAccess: command.commissionAccess }
        : {}),
      audit: {
        actorUserId: context.actor.id,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: id,
        metadata: {
          passwordChanged: passwordHash !== undefined,
          roleChanged: command.roleCode !== undefined,
          commissionAccessChanged: command.commissionAccess !== undefined,
        },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return publicUser(result.user);
  }

  async setActive(id: string, active: boolean, context: UserMutationContext): Promise<ManagedUser> {
    if (!active && id === context.actor.id) {
      throw new AppError(409, 'CANNOT_DEACTIVATE_SELF', 'Você não pode desativar a própria conta.');
    }
    const result = await this.repository.setUserActive({
      id,
      active,
      changedAt: new Date(),
      audit: {
        actorUserId: context.actor.id,
        action: active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'user',
        entityId: id,
        metadata: { active },
        requestId: context.requestId,
      },
    });
    if (result.outcome !== 'success') throw mutationError(result);
    return publicUser(result.user);
  }
}
