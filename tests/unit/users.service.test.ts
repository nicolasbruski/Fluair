import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/server/errors/app-error.js';
import {
  UsersService,
  type UserMutationContext,
} from '../../src/server/modules/users/users.service.js';
import { fakePasswordService } from '../helpers/in-memory-auth.repository.js';
import {
  InMemoryUsersRepository,
  managedAdministrator,
} from '../helpers/in-memory-users.repository.js';

const context: UserMutationContext = {
  actor: {
    id: managedAdministrator.id,
    name: managedAdministrator.name,
    email: managedAdministrator.email,
    permissions: ['user.view', 'user.manage'],
  },
  requestId: 'users-unit-test',
};

describe('UsersService', () => {
  it('lista acessos efetivos sem expor senha e cria conta com e-mail normalizado e hash', async () => {
    const repository = new InMemoryUsersRepository();
    const service = new UsersService(repository, fakePasswordService);

    const created = await service.create(
      {
        name: 'Nova Operadora',
        email: '  NOVA@Fluair.Test ',
        password: 'senha-inicial',
        roleCode: 'CALCULATION_OPERATOR',
        commissionAccess: true,
      },
      context,
    );

    expect(created).toMatchObject({
      email: 'nova@fluair.test',
      active: true,
      role: { code: 'CALCULATION_OPERATOR' },
      permissions: ['calculation.create', 'calculation.view', 'commission.access'],
    });
    expect(repository.passwordHashes.get(created.id)).toBe('hash:senha-inicial');
    const withoutCommissions = await service.update(
      created.id,
      { commissionAccess: false },
      context,
    );
    expect(withoutCommissions.permissions).not.toContain('commission.access');
    expect(JSON.stringify(await service.list())).not.toContain('senha-inicial');
    expect(repository.audits[0]?.action).toBe('USER_CREATED');
  });

  it('impede e-mail duplicado, autodesativação e remoção do último administrador', async () => {
    const repository = new InMemoryUsersRepository();
    const service = new UsersService(repository, fakePasswordService);

    await expect(
      service.create(
        {
          name: 'Duplicada',
          email: managedAdministrator.email,
          password: 'senha-inicial',
          roleCode: 'CALCULATION_OPERATOR',
        },
        context,
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_USED' });

    await expect(service.setActive(managedAdministrator.id, false, context)).rejects.toMatchObject({
      code: 'CANNOT_DEACTIVATE_SELF',
    });

    const otherActor = {
      ...context,
      actor: { ...context.actor, id: '00000000-0000-4000-8000-000000000099' },
    };
    await expect(
      service.update(managedAdministrator.id, { roleCode: 'CALCULATION_OPERATOR' }, otherActor),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof AppError && error.code === 'LAST_ACTIVE_ADMIN',
    );
  });
});
