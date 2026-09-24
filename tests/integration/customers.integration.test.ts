import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { ROLE_CODES } from '../../src/shared/auth.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import { CustomersService } from '../../src/server/modules/customers/customers.service.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';
import {
  customerClasses,
  customerSegments,
  InMemoryCustomersRepository,
  sampleCustomer,
} from '../helpers/in-memory-customers.repository.js';

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

function access(
  permissions: AccessUserRecord['rolePermissions'],
  roleCode: string = ROLE_CODES.administrator,
): AccessUserRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Administradora',
    email: 'admin@fluair.test',
    passwordHash: 'hash:senha-correta',
    active: true,
    roleCode,
    rolePermissions: permissions,
    permissionOverrides: [],
  };
}

function setup(user: AccessUserRecord) {
  const authRepository = new InMemoryAuthRepository();
  authRepository.addUser(user);
  const authService = new AuthService(authRepository, fakePasswordService, {
    secret: testConfig.SESSION_SECRET,
    sessionTtlMilliseconds: testConfig.SESSION_TTL_HOURS * 60 * 60 * 1_000,
    loginWindowMilliseconds: testConfig.LOGIN_WINDOW_MINUTES * 60 * 1_000,
    loginBlockMilliseconds: testConfig.LOGIN_BLOCK_MINUTES * 60 * 1_000,
    loginMaxAttempts: testConfig.LOGIN_MAX_ATTEMPTS,
    dummyPasswordHash: 'hash:dummy',
  });
  const repository = new InMemoryCustomersRepository();
  const app = createApp({
    config: testConfig,
    logger: pino({ level: 'silent' }),
    authService,
    customersService: new CustomersService(repository),
  });
  return { app, repository };
}

async function authenticatedAgent(app: ReturnType<typeof createApp>, user: AccessUserRecord) {
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .set('Origin', testConfig.APP_URL)
    .send({ email: user.email, password: 'senha-correta' })
    .expect(200);
  return agent;
}

describe('API de clientes', () => {
  it('lista somente classes e segmentos ativos, ordenados por nome', async () => {
    const user = access(['customer.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get('/api/v1/customers/classifications')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customerClasses).toEqual([
          customerClasses.endConsumer,
          customerClasses.implementer,
        ]);
        expect(body.data.customerSegments).toEqual([
          customerSegments.autoParts,
          customerSegments.fleetOwner,
        ]);
        expect(body.data.customerClasses).not.toContainEqual(customerClasses.inactiveReseller);
        expect(body.data.customerSegments).not.toContainEqual(
          customerSegments.inactiveServiceStation,
        );
      });
  });

  it('protege as opções de classificação por autenticação e permissão de clientes', async () => {
    const withoutPermission = access([]);
    const context = setup(withoutPermission);

    await request(context.app)
      .get('/api/v1/customers/classifications')
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_REQUIRED'));

    const deniedAgent = await authenticatedAgent(context.app, withoutPermission);
    await deniedAgent
      .get('/api/v1/customers/classifications')
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('PERMISSION_DENIED'));

    const manager = access(['customer.manage']);
    const managerContext = setup(manager);
    const managerAgent = await authenticatedAgent(managerContext.app, manager);
    await managerAgent.get('/api/v1/customers/classifications').expect(200);
  });

  it('lista e filtra clientes persistidos com paginação e filtros', async () => {
    const user = access(['customer.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const response = await agent
      .get(
        `/api/v1/customers?search=figueiredo&status=active&customerClassId=${customerClasses.implementer.id}&customerSegmentId=${customerSegments.fleetOwner.id}`,
      )
      .expect(200);

    expect(response.body.data.customers).toHaveLength(1);
    expect(response.body.data.customers[0]).toMatchObject({
      code: sampleCustomer.code,
      legalName: sampleCustomer.legalName,
      customerClass: customerClasses.implementer,
      customerSegment: customerSegments.fleetOwner,
      active: true,
    });
    expect(response.body.data.filters.segments).toContain('FROTISTA');
    expect(response.body.data.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1 });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns one customer by id for order prefill', async () => {
    const user = access(['customer.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get(`/api/v1/customers/${sampleCustomer.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customer).toMatchObject({
          id: sampleCustomer.id,
          code: sampleCustomer.code,
          legalName: sampleCustomer.legalName,
          orderNote: sampleCustomer.orderNote,
        });
      });

    await agent.get('/api/v1/customers/90000000-0000-4000-8000-000000000009').expect(404);
  });

  it('consulta os cálculos e itens vinculados ao cliente', async () => {
    const user = access(['customer.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get(`/api/v1/customers/${sampleCustomer.id}/calculation-links`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customer).toMatchObject({
          id: sampleCustomer.id,
          code: sampleCustomer.code,
          legalName: sampleCustomer.legalName,
        });
        expect(body.data.calculations).toEqual([]);
      });
  });

  it('exporta a classificação normalizada e aplica seus filtros', async () => {
    const user = access(['customer.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get(`/api/v1/customers/export?customerSegmentId=${customerSegments.fleetOwner.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customers).toHaveLength(1);
        expect(body.data.customers[0]).toMatchObject({
          id: sampleCustomer.id,
          customerClass: customerClasses.implementer,
          customerSegment: customerSegments.fleetOwner,
          seller: sampleCustomer.seller,
          representative: sampleCustomer.representative,
        });
      });

    await agent
      .get(`/api/v1/customers/export?customerSegmentId=${customerSegments.autoParts.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.data.customers).toEqual([]));
  });

  it('cria, edita e desativa cliente com auditoria', async () => {
    const user = access(['customer.view', 'customer.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const created = await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'create-customer-test')
      .send({
        code: 'c02000',
        legalName: '  Cliente Novo Ltda  ',
        cnpj: '12.345.678/0001-90',
        city: '  Curitiba  ',
        state: 'pr',
        segment: 'IMPLEMENTADOR',
        customerClassCode: 'implementer',
        customerSegmentId: customerSegments.fleetOwner.id,
        seller: 'Allan',
        representative: '',
        internalNote: 'Cliente prefere contato por e-mail.',
        orderNote: 'Separar a mercadoria por centro de custo.',
      })
      .expect(201);

    const id = created.body.data.customer.id as string;
    expect(created.body.data.customer).toMatchObject({
      code: 'C02000',
      legalName: 'Cliente Novo Ltda',
      cnpj: '12345678000190',
      city: 'Curitiba',
      state: 'PR',
      representative: null,
      customerClass: customerClasses.implementer,
      customerSegment: customerSegments.fleetOwner,
      internalNote: 'Cliente prefere contato por e-mail.',
      orderNote: 'Separar a mercadoria por centro de custo.',
    });

    await agent
      .patch(`/api/v1/customers/${id}`)
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'C02000',
        legalName: 'Cliente Atualizado Ltda',
        cnpj: '98.765.432/0001-10',
        city: 'Joinville',
        state: 'sc',
        segment: 'FROTISTA',
        customerClassId: customerClasses.endConsumer.id,
        customerSegmentCode: 'auto_parts',
        seller: 'Fernando',
        representative: 'Five',
        internalNote: 'Observação interna atualizada.',
        orderNote: 'Nova observação para os próximos pedidos.',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customer).toMatchObject({
          legalName: 'Cliente Atualizado Ltda',
          cnpj: '98765432000110',
          city: 'Joinville',
          state: 'SC',
          representative: 'Five',
          customerClass: customerClasses.endConsumer,
          customerSegment: customerSegments.autoParts,
          internalNote: 'Observação interna atualizada.',
          orderNote: 'Nova observação para os próximos pedidos.',
        });
      });

    await agent
      .post(`/api/v1/customers/${id}/deactivate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200)
      .expect(({ body }) => expect(body.data.customer.active).toBe(false));

    expect(context.repository.audits.map((audit) => audit.action)).toEqual([
      'CUSTOMER_CREATED',
      'CUSTOMER_UPDATED',
      'CUSTOMER_DEACTIVATED',
    ]);
  });

  it('pré-cadastra cliente para o pedido usando somente razão social, classe e segmento', async () => {
    const user = access(['customer.view', 'customer.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    const response = await agent
      .post('/api/v1/customers/pre-registration')
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'pre-register-customer-test')
      .send({
        legalName: '  Cliente do Pedido Ltda  ',
        customerClassId: customerClasses.implementer.id,
        customerSegmentId: customerSegments.fleetOwner.id,
      })
      .expect(201);

    expect(response.body.data.customer).toMatchObject({
      legalName: 'Cliente do Pedido Ltda',
      customerClass: customerClasses.implementer,
      customerSegment: customerSegments.fleetOwner,
      active: true,
      cnpj: null,
      city: null,
      state: null,
    });
    expect(response.body.data.customer.code).toMatch(/^PRE-[A-F0-9]{16}$/);
    expect(context.repository.audits.at(-1)).toMatchObject({
      action: 'CUSTOMER_PRE_REGISTERED',
      requestId: 'pre-register-customer-test',
    });
  });

  it('valida os três campos e restringe o pré-cadastro a administrador', async () => {
    const administrator = access(['customer.manage']);
    const context = setup(administrator);
    const agent = await authenticatedAgent(context.app, administrator);

    await agent
      .post('/api/v1/customers/pre-registration')
      .set('Origin', testConfig.APP_URL)
      .send({ legalName: 'Cliente incompleto' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.fieldErrors.customerClassId).toBeDefined();
        expect(body.error.fieldErrors.customerSegmentId).toBeDefined();
      });

    const operator = access(['customer.manage'], ROLE_CODES.calculationOperator);
    const operatorContext = setup(operator);
    const operatorAgent = await authenticatedAgent(operatorContext.app, operator);
    await operatorAgent
      .post('/api/v1/customers/pre-registration')
      .set('Origin', testConfig.APP_URL)
      .send({
        legalName: 'Cliente sem acesso',
        customerClassId: customerClasses.implementer.id,
        customerSegmentId: customerSegments.fleetOwner.id,
      })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('ROLE_DENIED'));
  });

  it('rejeita classificações inexistentes, inativas ou identificadas de forma ambígua', async () => {
    const user = access(['customer.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const input = {
      code: 'C02002',
      legalName: 'Cliente classificado',
      segment: '',
      seller: '',
      representative: '',
    };

    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({ ...input, customerClassCode: customerClasses.inactiveReseller.code })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CUSTOMER_CLASS_INACTIVE'));

    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({ ...input, customerSegmentId: '40000000-0000-4000-8000-999999999999' })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('CUSTOMER_SEGMENT_NOT_FOUND'));

    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({
        ...input,
        customerClassId: customerClasses.implementer.id,
        customerClassCode: customerClasses.implementer.code,
      })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe('VALIDATION_ERROR'));

    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({ ...input, customerClassId: 'classe-inválida' })
      .expect(400)
      .expect(({ body }) => expect(body.error.fieldErrors.customerClassId).toBeDefined());

    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({ ...input, customerSegmentCode: 'segmento inválido!' })
      .expect(400)
      .expect(({ body }) => expect(body.error.fieldErrors.customerSegmentCode).toBeDefined());

    expect(context.repository.customers).toHaveLength(1);
    expect(context.repository.audits).toEqual([]);
  });

  it('preserva classificações quando uma edição legada omite os novos campos', async () => {
    const user = access(['customer.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .patch(`/api/v1/customers/${sampleCustomer.id}`)
      .set('Origin', testConfig.APP_URL)
      .send({
        code: sampleCustomer.code,
        legalName: sampleCustomer.legalName,
        segment: sampleCustomer.segment,
        seller: 'Fernando',
        representative: 'Five',
        internalNote: sampleCustomer.internalNote,
        orderNote: sampleCustomer.orderNote,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customer.customerClass).toEqual(customerClasses.implementer);
        expect(body.data.customer.customerSegment).toEqual(customerSegments.fleetOwner);
        expect(body.data.customer.seller).toBe('Fernando');
        expect(body.data.customer.representative).toBe('Five');
      });

    await agent
      .patch(`/api/v1/customers/${sampleCustomer.id}`)
      .set('Origin', testConfig.APP_URL)
      .send({
        code: sampleCustomer.code,
        legalName: sampleCustomer.legalName,
        segment: sampleCustomer.segment,
        customerClassId: null,
        customerSegmentCode: '',
        seller: 'Fernando',
        representative: 'Five',
        internalNote: sampleCustomer.internalNote,
        orderNote: sampleCustomer.orderNote,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customer.customerClass).toBeNull();
        expect(body.data.customer.customerSegment).toBeNull();
      });
  });

  it('permite consulta, mas bloqueia alteração para usuário comum', async () => {
    const user = access(['customer.view'], ROLE_CODES.calculationOperator);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent.get('/api/v1/customers').expect(200);
    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'C02001',
        legalName: 'Sem permissão',
        segment: '',
        seller: '',
        representative: '',
      })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('ROLE_DENIED'));
  });

  it('bloqueia alterações para usuário comum mesmo com customer.manage', async () => {
    const user = access(['customer.view', 'customer.manage'], ROLE_CODES.calculationOperator);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent.get('/api/v1/customers').expect(200);
    await agent
      .patch(`/api/v1/customers/${sampleCustomer.id}`)
      .set('Origin', testConfig.APP_URL)
      .send({ legalName: 'Alteração indevida' })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('ROLE_DENIED'));
  });

  it('rejeita código duplicado com mensagem de campo', async () => {
    const user = access(['customer.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    await agent
      .post('/api/v1/customers')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: sampleCustomer.code,
        legalName: 'Duplicado',
        segment: '',
        seller: '',
        representative: '',
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe('CUSTOMER_CODE_ALREADY_USED');
        expect(body.error.fieldErrors.code).toBeDefined();
      });
  });
});

describe('integração do sistema de comissões', () => {
  it('protege a página e a API com a permissão individual de comissões', async () => {
    const withoutAccess = access(['customer.manage']);
    const deniedContext = setup(withoutAccess);

    await request(deniedContext.app)
      .get('/comissoes')
      .expect(302)
      .expect('Location', '/login?returnTo=%2Fcomissoes');

    const deniedAgent = await authenticatedAgent(deniedContext.app, withoutAccess);
    await deniedAgent.get('/comissoes').expect(302).expect('Location', '/sem-acesso');
    await deniedAgent
      .get('/api/v1/commissions/customers')
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('PERMISSION_DENIED'));
  });

  it('carrega e mantém no banco os clientes usados pelas comissões', async () => {
    const user: AccessUserRecord = {
      ...access([]),
      permissionOverrides: [{ code: 'commission.access', allowed: true }],
    };
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get('/comissoes')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect(({ text }) => {
        expect(text).toContain("apiRequest('/api/v1/commissions/customers')");
        expect(text).not.toContain('const INIT_DB=');
        expect(text).toContain('onclick="backToSystem()">Voltar ao sistema</button>');
        expect(text).toContain('onclick="logoutCommission()">Sair</button>');
      });

    await agent
      .get('/api/v1/commissions/customers')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.customers).toHaveLength(1);
        expect(body.data.customers[0]).toMatchObject({
          code: sampleCustomer.code,
          segment: 'FROTISTA',
          seller: 'Marcelo Ort',
          representative: null,
          customerClass: customerClasses.implementer,
          customerSegment: customerSegments.fleetOwner,
        });
      });

    const created = await agent
      .post('/api/v1/commissions/customers')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'C03000',
        legalName: 'Cliente das Comissões',
        segment: 'FROTISTA',
        seller: 'Fernando',
        representative: '',
      })
      .expect(201);

    expect(created.body.data.customer).toMatchObject({
      segment: 'FROTISTA',
      seller: 'Fernando',
      representative: null,
    });

    await agent
      .post(`/api/v1/commissions/customers/${created.body.data.customer.id as string}/deactivate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200)
      .expect(({ body }) => expect(body.data.customer.active).toBe(false));

    expect(context.repository.audits.map((audit) => audit.action)).toEqual([
      'CUSTOMER_CREATED',
      'CUSTOMER_DEACTIVATED',
    ]);
  });
});
