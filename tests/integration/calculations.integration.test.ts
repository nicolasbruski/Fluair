import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import type { CalculationsService } from '../../src/server/modules/calculations/calculations.service.js';
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

function setup(
  rolePermissions: AccessUserRecord['rolePermissions'] = ['calculation.create', 'calculation.view'],
) {
  const user: AccessUserRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Admin',
    email: 'admin@fluair.test',
    passwordHash: 'hash:senha-correta',
    active: true,
    rolePermissions,
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
  const calculations = {
    list: vi.fn().mockResolvedValue({
      data: {
        calculations: [],
        filters: { priceLists: [] },
        pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
      },
    }),
    preview: vi.fn().mockResolvedValue({ data: { preview: {} } }),
    save: vi.fn().mockResolvedValue({ data: { calculation: {} } }),
    detail: vi.fn().mockResolvedValue({ data: { calculation: { id: 'calculation' } } }),
    history: vi.fn().mockResolvedValue({ data: { versions: [] } }),
  };
  const app = createApp({
    config,
    logger: pino({ level: 'silent' }),
    authService: auth,
    calculationsService: calculations as unknown as CalculationsService,
  });
  return { app, user, calculations };
}

describe('contrato HTTP do cálculo dinâmico', () => {
  it('consulta detalhe e histórico pelo UUID real com permissões separadas', async () => {
    const context = setup(['calculation.view', 'calculation.history', 'calculation.create']);
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', config.APP_URL)
      .send({ email: context.user.email, password: 'senha-correta' })
      .expect(200);
    const id = '50000000-0000-4000-8000-000000000001';

    await agent.get(`/api/v1/calculations/${id}`).expect(200);
    await agent.get(`/api/v1/calculations/${id}/history`).expect(200);
    expect(context.calculations.detail).toHaveBeenCalledWith(id);
    expect(context.calculations.history).toHaveBeenCalledWith(id);
    await agent.get('/api/v1/calculations/invalido').expect(400);
  });

  it('protege a busca com calculation.view', async () => {
    const context = setup(['calculation.create']);
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', config.APP_URL)
      .send({ email: context.user.email, password: 'senha-correta' })
      .expect(200);

    await agent.get('/api/v1/calculations').expect(403);
    expect(context.calculations.list).not.toHaveBeenCalled();
  });

  it('valida e encaminha busca, filtro, ordenação e paginação', async () => {
    const context = setup();
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', config.APP_URL)
      .send({ email: context.user.email, password: 'senha-correta' })
      .expect(200);

    await agent
      .get(
        '/api/v1/calculations?search=KIT&priceListId=20000000-0000-4000-8000-000000000001&sort=minimumTotal&direction=asc&page=2&pageSize=30',
      )
      .expect(200);
    expect(context.calculations.list).toHaveBeenCalledWith({
      search: 'KIT',
      priceListId: '20000000-0000-4000-8000-000000000001',
      sort: 'minimumTotal',
      direction: 'asc',
      page: 2,
      pageSize: 30,
    });

    await agent.get('/api/v1/calculations?sort=unknown').expect(400);
    expect(context.calculations.list).toHaveBeenCalledOnce();
  });

  it('exige UUID da lista, cliente e versão esperada no salvamento', async () => {
    const context = setup();
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', config.APP_URL)
      .send({ email: context.user.email, password: 'senha-correta' })
      .expect(200);
    const listId = '20000000-0000-4000-8000-000000000001';
    const versionId = '30000000-0000-4000-8000-000000000001';
    const customerId = '40000000-0000-4000-8000-000000000001';

    await agent
      .post('/api/v1/calculations/preview/IMPLEMENTER')
      .set('Origin', config.APP_URL)
      .set('Content-Type', 'application/octet-stream')
      .set('x-file-name', 'folha.xlsx')
      .send(Buffer.from('arquivo'))
      .expect(400);
    await agent
      .post(
        '/api/v1/calculations/save/' +
          listId +
          '?recalculate=false&expectedPriceListVersionId=' +
          versionId,
      )
      .set('Origin', config.APP_URL)
      .set('Content-Type', 'application/octet-stream')
      .set('x-file-name', 'folha.xlsx')
      .send(Buffer.from('arquivo'))
      .expect(400);
    expect(context.calculations.save).not.toHaveBeenCalled();

    await agent
      .post(
        '/api/v1/calculations/save/' +
          listId +
          '?recalculate=false&expectedPriceListVersionId=' +
          versionId +
          '&customerId=' +
          customerId,
      )
      .set('Origin', config.APP_URL)
      .set('Content-Type', 'application/octet-stream')
      .set('x-file-name', 'folha.xlsx')
      .send(Buffer.from('arquivo'))
      .expect(200);
    expect(context.calculations.save).toHaveBeenCalledOnce();
  });

  it('recebe planilha, controles e foto opcional por multipart sem Base64', async () => {
    const context = setup();
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', config.APP_URL)
      .send({ email: context.user.email, password: 'senha-correta' })
      .expect(200);
    const listId = '20000000-0000-4000-8000-000000000001';
    const versionId = '30000000-0000-4000-8000-000000000001';
    const customerId = '40000000-0000-4000-8000-000000000001';
    const currentImageId = '70000000-0000-4000-8000-000000000001';
    const spreadsheet = Buffer.from('planilha binária');
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    await agent
      .post(`/api/v1/calculations/save/${listId}`)
      .set('Origin', config.APP_URL)
      .set('x-request-id', 'multipart-test')
      .field('recalculate', 'true')
      .field('customerId', customerId)
      .field('expectedPriceListVersionId', versionId)
      .field('expectedKitImageId', currentImageId)
      .attach('spreadsheet', spreadsheet, {
        filename: 'folha.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .attach('image', image, { filename: 'kit.jpg', contentType: 'image/jpeg' })
      .expect(200);

    expect(context.calculations.save).toHaveBeenCalledWith(
      listId,
      expect.objectContaining({ buffer: spreadsheet, fileName: 'folha.xlsx' }),
      {
        recalculate: true,
        customerId,
        expectedPriceListVersionId: versionId,
        expectedKitImageId: currentImageId,
        image: { data: image, fileName: 'kit.jpg', contentType: 'image/jpeg' },
      },
      expect.objectContaining({ requestId: 'multipart-test' }),
    );

    await agent
      .post(`/api/v1/calculations/save/${listId}`)
      .set('Origin', config.APP_URL)
      .field('recalculate', 'false')
      .field('customerId', customerId)
      .field('expectedPriceListVersionId', versionId)
      .attach('image', image, { filename: 'kit.jpg', contentType: 'image/jpeg' })
      .expect(400);
  });
});
