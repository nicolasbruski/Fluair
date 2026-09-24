import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/server/errors/app-error.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import {
  activeUser,
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';

function setup(maxAttempts = 3) {
  const repository = new InMemoryAuthRepository();
  repository.addUser(activeUser);
  const service = new AuthService(repository, fakePasswordService, {
    secret: 'test-secret-with-at-least-thirty-two-characters',
    sessionTtlMilliseconds: 60_000,
    loginWindowMilliseconds: 60_000,
    loginBlockMilliseconds: 60_000,
    loginMaxAttempts: maxAttempts,
    dummyPasswordHash: 'hash:dummy-password',
  });
  const context = { ipAddress: '127.0.0.1', userAgent: 'vitest', requestId: 'request-1' };
  return { repository, service, context };
}

describe('AuthService', () => {
  it('normaliza o e-mail, cria sessão persistente e aplica overrides de permissão', async () => {
    const { repository, service, context } = setup();
    const result = await service.login('  USUARIO@FLUAIR.TEST ', 'senha-correta', context);

    expect(result.sessionToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(repository.sessions.size).toBe(1);
    expect(result.user.permissions).toEqual(['calculation.view', 'matrix.view']);
    expect(repository.audits.at(-1)?.action).toBe('AUTH_LOGIN_SUCCEEDED');

    const current = await service.getCurrentSession(result.sessionToken);
    expect(current.user).toEqual(result.user);
  });

  it('não revela se o e-mail existe quando a senha está incorreta', async () => {
    const { service, context } = setup();
    await expect(
      service.login('desconhecido@fluair.test', 'errada', context),
    ).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
    });
    await expect(service.login(activeUser.email, 'errada', context)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
    });
  });

  it('recusa conta inativa mesmo com senha válida', async () => {
    const { repository, service, context } = setup();
    repository.addUser({ ...activeUser, active: false });
    await expect(service.login(activeUser.email, 'senha-correta', context)).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_INACTIVE',
    });
    expect(repository.sessions.size).toBe(0);
  });

  it('bloqueia temporariamente a combinação de conta e origem', async () => {
    const { repository, service, context } = setup(2);
    await expect(service.login(activeUser.email, 'errada', context)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(service.login(activeUser.email, 'errada', context)).rejects.toMatchObject({
      status: 429,
      code: 'TOO_MANY_ATTEMPTS',
    });
    await expect(service.login(activeUser.email, 'senha-correta', context)).rejects.toMatchObject({
      status: 429,
      code: 'TOO_MANY_ATTEMPTS',
    });
    expect(repository.audits.at(-1)).toMatchObject({
      actorUserId: null,
      action: 'AUTH_LOGIN_THROTTLED',
      metadata: { reason: 'TOO_MANY_ATTEMPTS' },
    });
  });

  it('revalida conta e permissão no servidor e invalida o logout', async () => {
    const { repository, service, context } = setup();
    const result = await service.login(activeUser.email, 'senha-correta', context);

    repository.addUser({
      ...activeUser,
      permissionOverrides: [
        ...activeUser.permissionOverrides,
        { code: 'calculation.view', allowed: false },
      ],
    });
    await expect(
      service.requirePermission(result.sessionToken, 'calculation.view', 'request-2'),
    ).rejects.toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
    expect(repository.audits.at(-1)?.action).toBe('AUTH_PERMISSION_DENIED');

    const persistedSessionId = [...repository.sessions.keys()][0];
    await service.logout(result.sessionToken, 'request-3');
    expect(repository.audits.at(-1)).toMatchObject({
      actorUserId: activeUser.id,
      action: 'AUTH_LOGOUT',
      entityId: persistedSessionId,
    });
    await expect(service.getCurrentSession(result.sessionToken)).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });
  });

  it('revoga a sessão quando a conta é desativada durante o uso', async () => {
    const { repository, service, context } = setup();
    const result = await service.login(activeUser.email, 'senha-correta', context);
    const persistedSessionId = [...repository.sessions.keys()][0];
    repository.addUser({ ...activeUser, active: false });

    await expect(service.getCurrentSession(result.sessionToken)).rejects.toMatchObject({
      status: 401,
      code: 'ACCOUNT_INACTIVE',
    });
    expect(repository.sessions.get(persistedSessionId ?? '')?.revokedAt).toBeInstanceOf(Date);
  });
});
