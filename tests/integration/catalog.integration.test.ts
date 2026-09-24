import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { CatalogService } from '../../src/server/modules/catalog/catalog.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';

const config: AppConfig = {
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

function setup(permissions: AccessUserRecord['rolePermissions']) {
  const user: AccessUserRecord = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Pessoa',
    email: 'pessoa@fluair.test',
    passwordHash: 'hash:senha-correta',
    active: true,
    rolePermissions: permissions,
    permissionOverrides: [],
  };
  const repository = new InMemoryAuthRepository();
  repository.addUser(user);
  const auth = new AuthService(repository, fakePasswordService, {
    secret: config.SESSION_SECRET,
    sessionTtlMilliseconds: 60_000,
    loginWindowMilliseconds: 60_000,
    loginBlockMilliseconds: 60_000,
    loginMaxAttempts: 5,
    dummyPasswordHash: 'hash:dummy',
  });
  const list = vi.fn().mockResolvedValue({
    data: { items: [] },
    pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
  });
  const app = createApp({
    config,
    logger: pino({ level: 'silent' }),
    authService: auth,
    catalogService: { list } as unknown as CatalogService,
  });
  return { app, user, list };
}

async function login(app: ReturnType<typeof createApp>, user: AccessUserRecord) {
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .set('Origin', config.APP_URL)
    .send({ email: user.email, password: 'senha-correta' })
    .expect(200);
  return agent;
}

describe('API do catálogo', () => {
  it('permite visualizar sem catalog.manage e valida os filtros', async () => {
    const context = setup(['price.view']);
    const agent = await login(context.app, context.user);
    await agent.get('/api/v1/catalog?filter=WITHOUT_IMAGE&page=2&pageSize=10').expect(200);
    expect(context.list).toHaveBeenCalledWith({
      search: '',
      filter: 'WITHOUT_IMAGE',
      page: 2,
      pageSize: 10,
    });
  });

  it('rejeita chamada direta sem sessão ou permissão de visualização', async () => {
    const context = setup(['calculation.history']);
    await request(context.app).get('/api/v1/catalog').expect(401);
    const agent = await login(context.app, context.user);
    await agent.get('/api/v1/catalog').expect(403);
    expect(context.list).not.toHaveBeenCalled();
  });
});
