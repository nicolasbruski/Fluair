import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import type { OrderPriceApprovalsService } from '../../src/server/modules/order-price-approvals/order-price-approvals.service.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';

const config: AppConfig = {
  NODE_ENV: 'test',
  PORT: 3000,
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'mysql://unused',
  SESSION_SECRET: 'integration-secret-with-at-least-32-characters',
  SESSION_TTL_HOURS: 8,
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_WINDOW_MINUTES: 15,
  LOGIN_BLOCK_MINUTES: 15,
  LOG_LEVEL: 'silent',
};
const userId = '00000000-0000-4000-8000-000000000001';
const customerId = '10000000-0000-4000-8000-000000000001';
const versionId = '20000000-0000-4000-8000-000000000001';
const approvalId = '30000000-0000-4000-8000-000000000001';

function setup(permissions: string[]) {
  const user: AccessUserRecord = {
    id: userId,
    name: 'Solicitante',
    email: 'solicitante@fluair.test',
    roleCode: 'CALCULATION_OPERATOR',
    passwordHash: 'hash:senha-correta',
    active: true,
    rolePermissions: permissions,
    permissionOverrides: [],
  };
  const authRepository = new InMemoryAuthRepository();
  authRepository.addUser(user);
  const auth = new AuthService(authRepository, fakePasswordService, {
    secret: config.SESSION_SECRET,
    sessionTtlMilliseconds: 8 * 60 * 60 * 1_000,
    loginWindowMilliseconds: 15 * 60 * 1_000,
    loginBlockMilliseconds: 15 * 60 * 1_000,
    loginMaxAttempts: 5,
    dummyPasswordHash: 'hash:dummy',
  });
  const approvals = {
    create: vi.fn().mockResolvedValue({
      data: { approval: { id: approvalId, status: 'PENDING' }, violations: [], replayed: false },
    }),
    mine: vi.fn().mockResolvedValue({
      data: [{ id: approvalId, status: 'PENDING' }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
    ownDetails: vi.fn().mockResolvedValue({ data: { id: approvalId, status: 'PENDING' } }),
    cancel: vi.fn().mockResolvedValue({ data: { id: approvalId, status: 'CANCELLED' } }),
    adminCount: vi.fn().mockResolvedValue({ data: { pending: 1 } }),
    adminList: vi.fn().mockResolvedValue({
      data: [{ id: approvalId, status: 'PENDING', waitingSeconds: 60 }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    }),
    adminDetails: vi.fn().mockResolvedValue({ data: { id: approvalId, status: 'PENDING' } }),
    approve: vi.fn().mockResolvedValue({ data: { id: approvalId, status: 'APPROVED' } }),
    reject: vi.fn().mockResolvedValue({ data: { id: approvalId, status: 'REJECTED' } }),
  };
  const app = createApp({
    config,
    logger: pino({ level: 'silent' }),
    authService: auth,
    orderPriceApprovalsService: approvals as unknown as OrderPriceApprovalsService,
  });
  return { app, user, approvals };
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

describe('API do ciclo do solicitante de aprovacao de preco', () => {
  it('exige price.override para criar, mas nao para consultar os proprios registros', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent
      .post('/api/v1/order-price-approvals')
      .set('Origin', config.APP_URL)
      .set('Idempotency-Key', 'approval:1234567890abcdef')
      .send({})
      .expect(403);
    await agent.get('/api/v1/order-price-approvals/mine').expect(200);
    expect(context.approvals.create).not.toHaveBeenCalled();
    expect(context.approvals.mine).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
  });

  it('normaliza e valida a criacao antes de encaminhar somente os campos confiaveis', async () => {
    const context = setup(['order.access', 'price.view', 'price.override']);
    const agent = await agentFor(context);
    await agent
      .post('/api/v1/order-price-approvals')
      .set('Origin', config.APP_URL)
      .set('Idempotency-Key', 'approval:1234567890abcdef')
      .send({
        customerId,
        lines: [
          {
            kind: 'STANDALONE_PRODUCT',
            productCode: 'P-01',
            priceListVersionId: versionId,
            quantity: 2,
            negotiatedUnitPrice: '12,50',
          },
        ],
        justification: '  Condicao   comercial especial.  ',
        minimumTotalAmount: '0.01',
      })
      .expect(400);

    await agent
      .post('/api/v1/order-price-approvals')
      .set('Origin', config.APP_URL)
      .set('Idempotency-Key', 'approval:1234567890abcdef')
      .send({
        customerId,
        lines: [
          {
            kind: 'STANDALONE_PRODUCT',
            productCode: 'P-01',
            priceListVersionId: versionId,
            quantity: 2,
            negotiatedUnitPrice: '12,50',
          },
        ],
        justification: '  Condicao   comercial especial.  ',
      })
      .expect(201);
    expect(context.approvals.create).toHaveBeenCalledWith(
      expect.objectContaining({
        justification: 'Condicao comercial especial.',
        lines: [expect.objectContaining({ negotiatedUnitPrice: '12.50' })],
      }),
      'approval:1234567890abcdef',
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
  });

  it('encaminha detalhe e cancelamento com o ator e versao esperada', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent.get(`/api/v1/order-price-approvals/${approvalId}`).expect(200);
    await agent
      .post(`/api/v1/order-price-approvals/${approvalId}/cancel`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 3 })
      .expect(200);
    expect(context.approvals.ownDetails).toHaveBeenCalledWith(
      approvalId,
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
    expect(context.approvals.cancel).toHaveBeenCalledWith(
      approvalId,
      { expectedVersion: 3 },
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
  });

  it('protege toda a API administrativa com a permissao dedicada', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent.get('/api/v1/order-price-approvals/admin/count').expect(403);
    await agent.get('/api/v1/order-price-approvals/admin').expect(403);
    await agent.get(`/api/v1/order-price-approvals/admin/${approvalId}`).expect(403);
    await agent
      .post(`/api/v1/order-price-approvals/admin/${approvalId}/approve`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 1 })
      .expect(403);
    await agent
      .post(`/api/v1/order-price-approvals/admin/${approvalId}/reject`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 1, reason: 'Preço não autorizado.' })
      .expect(403);
    expect(context.approvals.adminCount).not.toHaveBeenCalled();
  });

  it('valida filtros e decisoes e encaminha o ator administrativo', async () => {
    const context = setup(['order.price-approval.manage']);
    const agent = await agentFor(context);
    await agent
      .get('/api/v1/order-price-approvals/admin/count')
      .expect(200, { data: { pending: 1 } });
    await agent
      .get('/api/v1/order-price-approvals/admin')
      .query({ status: 'PENDING', page: 1, pageSize: 20, code: 'P-01' })
      .expect(200);
    await agent.get(`/api/v1/order-price-approvals/admin/${approvalId}`).expect(200);
    await agent
      .post(`/api/v1/order-price-approvals/admin/${approvalId}/approve`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 1, note: '  De acordo.  ' })
      .expect(200);
    await agent
      .post(`/api/v1/order-price-approvals/admin/${approvalId}/reject`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 1, reason: '  Margem insuficiente.  ' })
      .expect(200);
    expect(context.approvals.adminList).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', code: 'P-01', page: 1, pageSize: 20 }),
      expect.any(String),
    );
    expect(context.approvals.approve).toHaveBeenCalledWith(
      approvalId,
      { expectedVersion: 1, note: 'De acordo.' },
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
    expect(context.approvals.reject).toHaveBeenCalledWith(
      approvalId,
      { expectedVersion: 1, reason: 'Margem insuficiente.' },
      expect.objectContaining({ id: userId }),
      expect.any(String),
    );
  });

  it('rejeita motivo ausente e intervalo administrativo invertido', async () => {
    const context = setup(['order.price-approval.manage']);
    const agent = await agentFor(context);
    await agent
      .post(`/api/v1/order-price-approvals/admin/${approvalId}/reject`)
      .set('Origin', config.APP_URL)
      .send({ expectedVersion: 1 })
      .expect(400);
    await agent
      .get('/api/v1/order-price-approvals/admin')
      .query({ requestedFrom: '2026-10-02T00:00:00.000Z', requestedTo: '2026-10-01T00:00:00.000Z' })
      .expect(400);
    expect(context.approvals.reject).not.toHaveBeenCalled();
    expect(context.approvals.adminList).not.toHaveBeenCalled();
  });
});
