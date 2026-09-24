import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import type { OrdersService } from '../../src/server/modules/orders/orders.service.js';
import { ROLE_CODES } from '../../src/shared/auth.js';
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
const customerId = '10000000-0000-4000-8000-000000000001';
const priceListId = '20000000-0000-4000-8000-000000000001';
const savedItemId = '30000000-0000-4000-8000-000000000001';

function setup(permissions: string[], roleCode: string = ROLE_CODES.calculationOperator) {
  const user: AccessUserRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Pedidos',
    email: 'pedidos@fluair.test',
    roleCode,
    passwordHash: 'hash:senha-correta',
    active: true,
    rolePermissions: permissions,
    permissionOverrides: [],
  };
  const repository = new InMemoryAuthRepository();
  repository.addUser(user);
  const auth = new AuthService(repository, fakePasswordService, {
    secret: config.SESSION_SECRET,
    sessionTtlMilliseconds: 8 * 60 * 60 * 1_000,
    loginWindowMilliseconds: 15 * 60 * 1_000,
    loginBlockMilliseconds: 15 * 60 * 1_000,
    loginMaxAttempts: 5,
    dummyPasswordHash: 'hash:dummy',
  });
  const orders = {
    eligiblePriceLists: vi.fn().mockResolvedValue({ data: { priceLists: [] } }),
    savedCatalog: vi
      .fn()
      .mockResolvedValue({ data: { calculatedProducts: [], kits: [] }, pagination: {} }),
    savedKitComposition: vi.fn().mockResolvedValue({
      data: {
        kit: {
          calculationId: savedItemId,
          code: 'KIT-01',
          description: 'Kit calculado',
          customers: [],
          items: [],
        },
      },
    }),
    updateSavedCatalogItem: vi.fn().mockResolvedValue({ data: { updated: true } }),
    deleteSavedCatalogItem: vi.fn().mockResolvedValue(undefined),
    catalog: vi.fn().mockResolvedValue({ data: { products: [], kits: [] }, pagination: {} }),
    quote: vi.fn().mockResolvedValue({ data: { lines: [], total: '0.0000' } }),
  };
  const app = createApp({
    config,
    logger: pino({ level: 'silent' }),
    authService: auth,
    ordersService: orders as unknown as OrdersService,
  });
  return { app, user, orders };
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

describe('API de fontes do pedido', () => {
  it('exige order.access para consultar listas autorizadas', async () => {
    const context = setup(['price.view']);
    const agent = await agentFor(context);
    await agent.get(`/api/v1/orders/price-lists?customerId=${customerId}`).expect(403);
    expect(context.orders.eligiblePriceLists).not.toHaveBeenCalled();
  });

  it('exige também price.view ao retornar o catálogo com valores', async () => {
    const context = setup(['order.access']);
    const agent = await agentFor(context);
    await agent
      .get(`/api/v1/orders/catalog?customerId=${customerId}&priceListId=${priceListId}`)
      .expect(403);
    expect(context.orders.catalog).not.toHaveBeenCalled();
  });

  it('carrega o catálogo salvo sem exigir cliente ou lista', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent.get('/api/v1/orders/saved-catalog?search=kit&page=2&pageSize=10').expect(200);
    expect(context.orders.savedCatalog).toHaveBeenCalledWith({
      search: 'kit',
      page: 2,
      pageSize: 10,
    });
  });

  it('carrega a composicao de um kit salvo com a permissao da tela de produtos', async () => {
    const context = setup(['price.view']);
    const agent = await agentFor(context);
    await agent.get(`/api/v1/orders/saved-catalog/kits/${savedItemId}/composition`).expect(200);
    expect(context.orders.savedKitComposition).toHaveBeenCalledWith(savedItemId);
  });

  it('exige perfil administrador para editar ou excluir itens salvos', async () => {
    const denied = setup(['price.view']);
    const deniedAgent = await agentFor(denied);
    await deniedAgent
      .patch(`/api/v1/orders/saved-catalog/products/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .send({ description: 'Produto', minimumPrice: '10.00', normalPrice: '12.00' })
      .expect(403);
    await deniedAgent
      .delete(`/api/v1/orders/saved-catalog/kits/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .expect(403);
    expect(denied.orders.updateSavedCatalogItem).not.toHaveBeenCalled();
    expect(denied.orders.deleteSavedCatalogItem).not.toHaveBeenCalled();

    const operatorWithOverride = setup(['price.view', 'price.override']);
    const operatorAgent = await agentFor(operatorWithOverride);
    await operatorAgent
      .patch(`/api/v1/orders/saved-catalog/products/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .send({ description: 'Produto', minimumPrice: '10.00', normalPrice: '12.00' })
      .expect(403);
    expect(operatorWithOverride.orders.updateSavedCatalogItem).not.toHaveBeenCalled();
  });

  it('valida e encaminha edição e exclusão do catálogo salvo', async () => {
    const context = setup(['price.view', 'price.override'], ROLE_CODES.administrator);
    const agent = await agentFor(context);
    await agent
      .patch(`/api/v1/orders/saved-catalog/products/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .send({ description: 'Produto atualizado', minimumPrice: '10,50', normalPrice: '12.00' })
      .expect(200);
    expect(context.orders.updateSavedCatalogItem).toHaveBeenCalledWith(
      { kind: 'products', id: savedItemId },
      { description: 'Produto atualizado', minimumPrice: '10.50', normalPrice: '12.00' },
    );
    await agent
      .delete(`/api/v1/orders/saved-catalog/kits/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .expect(204);
    expect(context.orders.deleteSavedCatalogItem).toHaveBeenCalledWith({
      kind: 'kits',
      id: savedItemId,
    });
    await agent
      .patch(`/api/v1/orders/saved-catalog/products/${savedItemId}`)
      .set('Origin', config.APP_URL)
      .send({ description: 'Produto', minimumPrice: '20', normalPrice: '10' })
      .expect(400);
  });

  it('exige order.access e price.view para cotar', async () => {
    const withoutOrder = setup(['price.view']);
    await (await agentFor(withoutOrder)).post('/api/v1/orders/quote').send({}).expect(403);
    const withoutPrice = setup(['order.access']);
    await (await agentFor(withoutPrice)).post('/api/v1/orders/quote').send({}).expect(403);
    expect(withoutOrder.orders.quote).not.toHaveBeenCalled();
    expect(withoutPrice.orders.quote).not.toHaveBeenCalled();
  });

  it('valida a cotação e descarta preços enviados pelo navegador', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent
      .post('/api/v1/orders/quote')
      .set('Origin', config.APP_URL)
      .send({
        customerId,
        priceListId,
        lines: [
          {
            kind: 'STANDALONE_PRODUCT',
            productCode: 'P-01',
            priceListVersionId: savedItemId,
            quantity: 2,
            unitPrice: '0.01',
            subtotal: '0.02',
          },
        ],
      })
      .expect(200);
    expect(context.orders.quote).toHaveBeenCalledWith({
      customerId,
      lines: [
        {
          kind: 'STANDALONE_PRODUCT',
          productCode: 'P-01',
          priceListVersionId: savedItemId,
          quantity: 2,
        },
      ],
    });
  });

  it('valida e encaminha cliente, lista, quantidade, busca e paginação', async () => {
    const context = setup(['order.access', 'price.view']);
    const agent = await agentFor(context);
    await agent
      .get(`/api/v1/orders/price-lists?customerId=${customerId}&quantity=3&quantity=4`)
      .expect(200);
    expect(context.orders.eligiblePriceLists).toHaveBeenCalledWith({
      customerId,
      quantities: [3, 4],
    });
    await agent
      .get(
        `/api/v1/orders/catalog?customerId=${customerId}&priceListId=${priceListId}&quantity=3&quantity=4&search=ref&page=2&pageSize=10`,
      )
      .expect(200);
    expect(context.orders.catalog).toHaveBeenCalledWith({
      customerId,
      priceListId,
      quantities: [3, 4],
      search: 'ref',
      page: 2,
      pageSize: 10,
    });
    await agent
      .get(`/api/v1/orders/catalog?customerId=${customerId}&priceListId=${priceListId}&pageSize=51`)
      .expect(400);
    await agent
      .get(`/api/v1/orders/catalog?customerId=${customerId}&priceListId=${priceListId}&quantity=0`)
      .expect(400);
    expect(context.orders.catalog).toHaveBeenCalledOnce();
  });
});
