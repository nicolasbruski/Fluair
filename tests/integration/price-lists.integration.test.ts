import { Buffer } from 'node:buffer';

import pino from 'pino';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import { PriceListsService } from '../../src/server/modules/price-lists/price-lists.service.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';
import {
  firstListVersion,
  inactiveListSegment,
  InMemoryPriceListsRepository,
  listSegment,
  secondListVersion,
} from '../helpers/in-memory-price-lists.repository.js';

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

function access(permissions: AccessUserRecord['rolePermissions']): AccessUserRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Administradora',
    email: 'admin@fluair.test',
    passwordHash: 'hash:senha-correta',
    active: true,
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
  const repository = new InMemoryPriceListsRepository();
  const app = createApp({
    config: testConfig,
    logger: pino({ level: 'silent' }),
    authService,
    priceListsService: new PriceListsService(repository),
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

function workbook(rows: unknown[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Dados');
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
}

function spreadsheetRequest(
  agent: ReturnType<typeof request.agent>,
  path: string,
  buffer: Buffer,
  expectedFileHash?: string,
) {
  return agent
    .post(path)
    .set('Origin', testConfig.APP_URL)
    .set('Content-Type', 'application/octet-stream')
    .set('x-file-name', encodeURIComponent('lista-sintetica.xlsx'))
    .set(expectedFileHash ? { 'x-expected-file-hash': expectedFileHash } : {})
    .send(buffer);
}

describe('API administrativa de listas de preço', () => {
  it('lista definições, público, faixa e versão ativa com matrix.view', async () => {
    const user = access(['matrix.view']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .get('/api/v1/price-lists')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect(({ body }) => {
        expect(body.data.priceLists).toHaveLength(1);
        expect(body.data.priceLists[0]).toMatchObject({
          code: 'IMPLEMENTER',
          type: 'KIT_COMPONENT',
          customerClasses: [{ code: 'IMPLEMENTER' }],
          customerSegments: [],
          activeVersion: {
            id: firstListVersion.id,
            version: 1,
            fileName: 'matriz.xlsx',
            importedBy: 'Administradora',
          },
        });
      });
  });

  it('protege consultas e mutações com matrix.view e matrix.manage', async () => {
    const withoutPermission = access([]);
    const denied = setup(withoutPermission);

    await request(denied.app).get('/api/v1/price-lists').expect(401);
    const deniedAgent = await authenticatedAgent(denied.app, withoutPermission);
    await deniedAgent.get('/api/v1/price-lists').expect(403);

    const viewer = access(['matrix.view']);
    const viewerContext = setup(viewer);
    const viewerAgent = await authenticatedAgent(viewerContext.app, viewer);
    await viewerAgent.get('/api/v1/price-lists').expect(200);
    await viewerAgent
      .get(`/api/v1/price-lists/${firstListVersion.priceListId}/active-version/structure`)
      .expect(403);
    await viewerAgent
      .post('/api/v1/price-lists')
      .set('Origin', testConfig.APP_URL)
      .send({ code: 'DENIED', name: 'Sem permissão', type: 'KIT_COMPONENT' })
      .expect(403);
  });

  it('retorna ao administrador a estrutura persistida da versão ativa', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    context.repository.versionItems.set(firstListVersion.id, [
      {
        code: 'COMP-001',
        description: 'Componente salvo',
        minimumPrice: 12.34,
        normalPrice: 15.67,
        sourceRow: 8,
        rawData: ['COMP-001', 'Componente salvo', 12.34, 15.67],
      },
    ]);
    const agent = await authenticatedAgent(context.app, user);

    const response = await agent
      .get(`/api/v1/price-lists/${firstListVersion.priceListId}/active-version/structure`)
      .query({ page: 1, pageSize: 50 })
      .expect(200);

    expect(response.body).toMatchObject({
      data: {
        priceList: { id: firstListVersion.priceListId, type: 'KIT_COMPONENT' },
        version: { id: firstListVersion.id, version: 1 },
        items: [
          {
            code: 'COMP-001',
            description: 'Componente salvo',
            minimumPrice: '12.34',
            normalPrice: '15.67',
            sourceRow: 8,
          },
        ],
      },
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
  });

  it('cria, edita, ativa e configura versão com auditoria', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    const created = await agent
      .post('/api/v1/price-lists')
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'price-list-create')
      .send({
        code: 'custom_products',
        name: 'Produtos personalizados',
        type: 'STANDALONE_PRODUCT',
        minimumOrderQuantity: 0,
        maximumOrderQuantity: 49,
        customerSegmentIds: [listSegment.id, listSegment.id],
      })
      .expect(201);
    const id = created.body.data.priceList.id as string;
    expect(created.body.data.priceList).toMatchObject({
      code: 'CUSTOM_PRODUCTS',
      active: true,
      minimumOrderQuantity: 0,
      maximumOrderQuantity: 49,
      customerSegments: [listSegment],
      activeVersion: null,
    });

    await agent
      .patch(`/api/v1/price-lists/${id}`)
      .set('Origin', testConfig.APP_URL)
      .send({ name: 'Produtos 100+', minimumOrderQuantity: 100, maximumOrderQuantity: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.priceList).toMatchObject({
          name: 'Produtos 100+',
          minimumOrderQuantity: 100,
          maximumOrderQuantity: null,
        });
      });

    await agent
      .post(`/api/v1/price-lists/${id}/deactivate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200)
      .expect(({ body }) => expect(body.data.priceList.active).toBe(false));
    await agent
      .post(`/api/v1/price-lists/${id}/activate`)
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200)
      .expect(({ body }) => expect(body.data.priceList.active).toBe(true));

    await agent
      .put(`/api/v1/price-lists/${firstListVersion.priceListId}/active-version`)
      .set('Origin', testConfig.APP_URL)
      .send({ versionId: null })
      .expect(200)
      .expect(({ body }) => expect(body.data.priceList.activeVersion).toBeNull());

    expect(context.repository.audits).toEqual([
      { action: 'PRICE_LIST_CREATED', entityId: id, requestId: 'price-list-create' },
      expect.objectContaining({ action: 'PRICE_LIST_UPDATED', entityId: id }),
      expect.objectContaining({ action: 'PRICE_LIST_DEACTIVATED', entityId: id }),
      expect.objectContaining({ action: 'PRICE_LIST_ACTIVATED', entityId: id }),
      expect.objectContaining({
        action: 'PRICE_LIST_ACTIVE_VERSION_CHANGED',
        entityId: firstListVersion.priceListId,
      }),
    ]);
  });

  it('rejeita público incompatível, classificação inativa e versão de outra lista', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);

    await agent
      .post('/api/v1/price-lists')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'INVALID_CLASS',
        name: 'Lista inválida',
        type: 'STANDALONE_PRODUCT',
        customerClassIds: ['30000000-0000-4000-8000-000000000001'],
      })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('PRICE_LIST_CLASSES_NOT_ALLOWED'));

    await agent
      .post('/api/v1/price-lists')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'INACTIVE_SEGMENT',
        name: 'Segmento inativo',
        type: 'STANDALONE_PRODUCT',
        customerSegmentIds: [inactiveListSegment.id],
      })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('PRICE_LIST_SEGMENT_INACTIVE'));

    await agent
      .put(`/api/v1/price-lists/${firstListVersion.priceListId}/active-version`)
      .set('Origin', testConfig.APP_URL)
      .send({ versionId: secondListVersion.id })
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('PRICE_LIST_VERSION_MISMATCH'));

    expect(context.repository.audits).toEqual([]);
  });

  it('gera prévia válida ou inválida sem criar versão, item, ativação ou auditoria', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const listId = firstListVersion.priceListId;
    const activeBefore = context.repository.lists[0]!.activeVersionId;
    const versionCountBefore = context.repository.versions.length;
    const validFile = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-01', 'Componente sintético', 20, 10],
    ]);

    const valid = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      validFile,
    ).expect(200);
    expect(valid.body.data.preview).toMatchObject({
      priceList: { id: listId, type: 'KIT_COMPONENT' },
      fileName: 'lista-sintetica.xlsx',
      fileSize: validFile.length,
      valid: true,
      itemCount: 1,
      errors: [],
      warnings: [{ severity: 'WARNING', code: 'MINIMUM_PRICE_ABOVE_NORMAL', row: 2 }],
    });
    expect(valid.body.data.preview.fileHash).toMatch(/^[a-f0-9]{64}$/);

    const invalidFile = workbook([
      ['Código', 'Descrição', 'Referência', 'Valor', 'IPI'],
      ['TEST-01', 'Produto sintético', 'REF', 10, 3],
    ]);
    const invalid = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      invalidFile,
    )
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.preview).toMatchObject({
          valid: false,
          itemCount: 0,
          errors: [{ severity: 'ERROR', code: 'KIT_COMPONENT_HEADER_NOT_FOUND' }],
        });
      });
    await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      invalidFile,
      invalid.body.data.preview.fileHash as string,
    )
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('KIT_COMPONENT_HEADER_NOT_FOUND'));

    expect(context.repository.versions).toHaveLength(versionCountBefore);
    expect(context.repository.versionItems).toHaveLength(0);
    expect(context.repository.lists[0]!.activeVersionId).toBe(activeBefore);
    expect(context.repository.audits).toEqual([]);
  });

  it('protege também a prévia de importação com matrix.manage', async () => {
    const viewer = access(['matrix.view']);
    const context = setup(viewer);
    const agent = await authenticatedAgent(context.app, viewer);
    const file = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-01', 'Componente sintético', 10, 20],
    ]);

    await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${firstListVersion.priceListId}/import/preview`,
      file,
    ).expect(403);
    expect(context.repository.audits).toEqual([]);
  });

  it('reanálise na confirmação, cria versões sequenciais e rejeita duplicidade', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const listId = firstListVersion.priceListId;
    const firstFile = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-01', 'Componente sintético', 10, 20],
    ]);
    const firstPreview = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      firstFile,
    ).expect(200);
    const firstHash = firstPreview.body.data.preview.fileHash as string;

    const firstImport = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      firstFile,
      firstHash,
    )
      .set('x-request-id', 'confirm-version-two')
      .expect(201);
    expect(firstImport.body.data.imported).toMatchObject({
      priceListId: listId,
      version: { version: 2, fileHash: firstHash, itemCount: 1 },
      warnings: [],
    });

    const secondFile = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-02', 'Outro componente', 30, 40],
    ]);
    const secondPreview = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      secondFile,
    ).expect(200);
    const secondHash = secondPreview.body.data.preview.fileHash as string;
    const secondImport = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      secondFile,
      secondHash,
    ).expect(201);
    expect(secondImport.body.data.imported.version.version).toBe(3);
    expect(context.repository.lists[0]!.activeVersionId).toBe(
      secondImport.body.data.imported.version.id,
    );

    await spreadsheetRequest(agent, `/api/v1/price-lists/${listId}/import/preview`, firstFile)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.preview.valid).toBe(false);
        expect(body.data.preview.errors[0].code).toBe('PRICE_LIST_FILE_ALREADY_IMPORTED');
      });
    await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      firstFile,
      firstHash,
    )
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('PRICE_LIST_FILE_ALREADY_IMPORTED'));

    expect(context.repository.audits).toEqual([
      expect.objectContaining({
        action: 'PRICE_LIST_VERSION_IMPORTED',
        requestId: 'confirm-version-two',
      }),
      expect.objectContaining({ action: 'PRICE_LIST_VERSION_IMPORTED' }),
    ]);
  });

  it('persiste o formato avulso com referência, IPI e ICMS por lista', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const created = await agent
      .post('/api/v1/price-lists')
      .set('Origin', testConfig.APP_URL)
      .send({
        code: 'STANDALONE_IMPORT',
        name: 'Importação avulsa',
        type: 'STANDALONE_PRODUCT',
        customerSegmentIds: [listSegment.id],
      })
      .expect(201);
    const listId = created.body.data.priceList.id as string;
    context.repository.products.set('PRODUCT-01', {
      code: 'PRODUCT-01',
      description: 'Descrição anterior',
      reference: 'REF-ANTIGA',
      unit: 'PC',
    });
    const file = workbook([
      ['Código', 'Descrição', 'Referência', 'Valor', 'IPI', 'ICMS'],
      ['PRODUCT-01', 'Produto sintético', 'REF-01', '123,45', '3,25%', '12%'],
      ['PRODUCT-02', 'Produto novo', 'REF-02', '10,1234', '0%', '18%'],
    ]);
    const preview = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      file,
    ).expect(200);
    const hash = preview.body.data.preview.fileHash as string;
    const confirmed = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      file,
      hash,
    ).expect(201);
    const versionId = confirmed.body.data.imported.version.id as string;

    expect(context.repository.versionItems.get(versionId)).toEqual([
      expect.objectContaining({
        code: 'PRODUCT-01',
        description: 'Produto sintético',
        reference: 'REF-01',
        unitPrice: 123.45,
        ipiRate: 3.25,
        ipiIncluded: true,
        icmsRate: 12,
      }),
      expect.objectContaining({
        code: 'PRODUCT-02',
        description: 'Produto novo',
        reference: 'REF-02',
        unitPrice: 10.1234,
        ipiRate: 0,
        ipiIncluded: true,
        icmsRate: 18,
      }),
    ]);
    expect(context.repository.products.get('PRODUCT-01')).toEqual({
      code: 'PRODUCT-01',
      description: 'Produto sintético',
      reference: 'REF-01',
      unit: 'PC',
    });
    expect(context.repository.products.get('PRODUCT-02')).toEqual({
      code: 'PRODUCT-02',
      description: 'Produto novo',
      reference: 'REF-02',
      unit: null,
    });
    expect(context.repository.lists.find(({ id }) => id === listId)!.activeVersionId).toBe(
      versionId,
    );
  });

  it('rejeita hash divergente e reverte versão, itens, ativação e auditoria em falha', async () => {
    const user = access(['matrix.manage']);
    const context = setup(user);
    const agent = await authenticatedAgent(context.app, user);
    const listId = firstListVersion.priceListId;
    const previewedFile = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-01', 'Componente sintético', 10, 20],
    ]);
    const changedFile = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['TEST-01', 'Componente alterado', 11, 21],
    ]);
    const preview = await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/preview`,
      previewedFile,
    ).expect(200);
    const expectedHash = preview.body.data.preview.fileHash as string;

    await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      changedFile,
      expectedHash,
    )
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('PRICE_LIST_PREVIEW_HASH_MISMATCH'));

    const activeBefore = context.repository.lists[0]!.activeVersionId;
    const versionsBefore = context.repository.versions.length;
    context.repository.failNextImportAfterWrite = true;
    await spreadsheetRequest(
      agent,
      `/api/v1/price-lists/${listId}/import/confirm`,
      previewedFile,
      expectedHash,
    ).expect(500);

    expect(context.repository.versions).toHaveLength(versionsBefore);
    expect(context.repository.versionItems).toHaveLength(0);
    expect(context.repository.lists[0]!.activeVersionId).toBe(activeBefore);
    expect(context.repository.audits).toEqual([]);
  });
});
