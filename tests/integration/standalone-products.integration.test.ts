import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import { PriceListsService } from '../../src/server/modules/price-lists/price-lists.service.js';
import type { StandaloneProductsService } from '../../src/server/modules/price-lists/standalone-products.service.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';
import { InMemoryPriceListsRepository } from '../helpers/in-memory-price-lists.repository.js';

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
const listId = '60000000-0000-4000-8000-000000000001';
const productCode = 'PRD-01';

function setup(permissions: string[]) {
  const user: AccessUserRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Usuário',
    email: 'usuario@fluair.test',
    passwordHash: 'hash:senha-correta',
    active: true,
    rolePermissions: permissions,
    permissionOverrides: [],
  };
  const repository = new InMemoryAuthRepository();
  repository.addUser(user);
  const auth = new AuthService(repository, fakePasswordService, {
    secret: config.SESSION_SECRET,
    sessionTtlMilliseconds: config.SESSION_TTL_HOURS * 60 * 60 * 1_000,
    loginWindowMilliseconds: config.LOGIN_WINDOW_MINUTES * 60 * 1_000,
    loginBlockMilliseconds: config.LOGIN_BLOCK_MINUTES * 60 * 1_000,
    loginMaxAttempts: config.LOGIN_MAX_ATTEMPTS,
    dummyPasswordHash: 'hash:dummy',
  });
  const products = {
    list: vi.fn().mockResolvedValue({
      data: { priceList: {}, version: {}, products: [] },
      pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 },
    }),
    price: vi.fn().mockResolvedValue({ data: { priceList: {}, version: {}, product: {} } }),
  };
  const app = createApp({
    config,
    logger: pino({ level: 'silent' }),
    authService: auth,
    priceListsService: new PriceListsService(new InMemoryPriceListsRepository()),
    standaloneProductsService: products as unknown as StandaloneProductsService,
  });
  return { app, user, products };
}

async function agentFor(context: ReturnType<typeof setup>) {
  const agent = request.agent(context.app);
  await agent
    .post('/api/v1/auth/login')
    .set('Origin', config.APP_URL)
    .send({ email: context.user.email, password: 'senha-correta' })
    .expect(200);
  return agent;
}

describe('API do catálogo de produtos sem estrutura', () => {
  it('exige price.view para catálogo e preço', async () => {
    const anonymous = setup(['price.view']);
    await request(anonymous.app)
      .get('/api/v1/price-lists/' + listId + '/products')
      .expect(401);
    const denied = setup(['matrix.view']);
    const deniedAgent = await agentFor(denied);
    await deniedAgent.get('/api/v1/price-lists/' + listId + '/products').expect(403);
    await deniedAgent
      .get('/api/v1/price-lists/' + listId + '/products/' + productCode + '/price')
      .expect(403);
    expect(denied.products.list).not.toHaveBeenCalled();
    expect(denied.products.price).not.toHaveBeenCalled();
  });

  it('valida e encaminha busca, paginação, lista e código', async () => {
    const context = setup(['price.view']);
    const agent = await agentFor(context);
    await agent
      .get('/api/v1/price-lists/' + listId + '/products?search=ref&page=2&pageSize=10')
      .expect(200)
      .expect(({ body }) => expect(body.pagination).toMatchObject({ page: 2, pageSize: 10 }));
    expect(context.products.list).toHaveBeenCalledWith(listId, {
      search: 'ref',
      page: 2,
      pageSize: 10,
    });
    await agent
      .get('/api/v1/price-lists/' + listId + '/products/' + productCode + '/price')
      .expect(200);
    expect(context.products.price).toHaveBeenCalledWith(listId, productCode);
    await agent.get('/api/v1/price-lists/' + listId + '/products?pageSize=51').expect(400);
    expect(context.products.list).toHaveBeenCalledOnce();
  });
});
