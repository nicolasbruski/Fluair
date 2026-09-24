import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import { UsersService } from '../../src/server/modules/users/users.service.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';
import {
  InMemoryUsersRepository,
  managedAdministrator,
} from '../helpers/in-memory-users.repository.js';

const testConfig: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'mysql://unused:unused@localhost:3306/unused',
  SESSION_SECRET: 'integration-secret-with-at-least-32-characters',
  SESSION_TTL_HOURS: 8,
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_WINDOW_MINUTES: 15,
  LOGIN_BLOCK_MINUTES: 15,
  LOG_LEVEL: 'silent',
};

const adminAccess: AccessUserRecord = {
  id: managedAdministrator.id,
  name: managedAdministrator.name,
  email: managedAdministrator.email,
  passwordHash: 'hash:senha-correta',
  active: true,
  rolePermissions: ['user.view', 'user.manage'],
  permissionOverrides: [],
};

function setup(access: AccessUserRecord = adminAccess) {
  const authRepository = new InMemoryAuthRepository();
  authRepository.addUser(access);
  const authService = new AuthService(authRepository, fakePasswordService, {
    secret: testConfig.SESSION_SECRET,
    sessionTtlMilliseconds: testConfig.SESSION_TTL_HOURS * 60 * 60 * 1_000,
    loginWindowMilliseconds: testConfig.LOGIN_WINDOW_MINUTES * 60 * 1_000,
    loginBlockMilliseconds: testConfig.LOGIN_BLOCK_MINUTES * 60 * 1_000,
    loginMaxAttempts: testConfig.LOGIN_MAX_ATTEMPTS,
    dummyPasswordHash: 'hash:dummy',
  });
  const usersRepository = new InMemoryUsersRepository();
  const usersService = new UsersService(usersRepository, fakePasswordService);
  const app = createApp({
    config: testConfig,
    logger: pino({ level: 'silent' }),
    authService,
    usersService,
  });
  return { app, usersRepository };
}

async function authenticatedAgent(app: ReturnType<typeof createApp>, access = adminAccess) {
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .set('Origin', testConfig.APP_URL)
    .send({ email: access.email, password: 'senha-correta' })
    .expect(200);
  return agent;
}

describe('API de usuários', () => {
  it('lista usuários e perfis reais sem retornar hashes de senha', async () => {
    const context = setup();
    const agent = await authenticatedAgent(context.app);
    const response = await agent.get('/api/v1/users').expect(200);

    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0]).toMatchObject({
      id: managedAdministrator.id,
      email: managedAdministrator.email,
      active: true,
    });
    expect(response.body.data.roles.length).toBeGreaterThan(1);
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('cria, edita e desativa uma conta com auditoria', async () => {
    const context = setup();
    const agent = await authenticatedAgent(context.app);
    const created = await agent
      .post('/api/v1/users')
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'create-user-test')
      .send({
        name: 'Operadora',
        email: 'OPERADORA@fluair.test',
        password: 'senha-inicial',
        roleCode: 'CALCULATION_OPERATOR',
      })
      .expect(201);

    const id = created.body.data.user.id as string;
    expect(created.body.data.user.email).toBe('operadora@fluair.test');
    expect(context.usersRepository.passwordHashes.get(id)).toBe('hash:senha-inicial');

    await agent
      .patch(`/api/v1/users/${id}`)
      .set('Origin', testConfig.APP_URL)
      .send({
        name: 'Operadora Atualizada',
        email: 'nova@fluair.test',
        commissionAccess: true,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user).toMatchObject({
          name: 'Operadora Atualizada',
          email: 'nova@fluair.test',
        });
        expect(body.data.user.permissions).toContain('commission.access');
      });

    await agent
      .post(`/api/v1/users/${id}/deactivate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user.active).toBe(false);
      });

    expect(context.usersRepository.audits.map((audit) => audit.action)).toEqual([
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DEACTIVATED',
    ]);
  });

  it('permite consulta com user.view, mas protege todas as mutações com user.manage', async () => {
    const viewer: AccessUserRecord = {
      ...adminAccess,
      rolePermissions: ['user.view'],
    };
    const context = setup(viewer);
    const agent = await authenticatedAgent(context.app, viewer);

    await agent.get('/api/v1/users').expect(200);
    await agent
      .post('/api/v1/users')
      .set('Origin', testConfig.APP_URL)
      .send({
        name: 'Sem Permissão',
        email: 'sem-permissao@fluair.test',
        password: 'senha-inicial',
        roleCode: 'CALCULATION_OPERATOR',
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe('PERMISSION_DENIED');
      });
  });

  it('não permite que o usuário desative a própria conta', async () => {
    const context = setup();
    const agent = await authenticatedAgent(context.app);
    await agent
      .post(`/api/v1/users/${managedAdministrator.id}/deactivate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
      });
  });
});
