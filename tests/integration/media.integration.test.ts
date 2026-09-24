import { createHash } from 'node:crypto';

import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import { MediaService } from '../../src/server/modules/media/media.service.js';
import type {
  MediaEntityType,
  MediaMutationContext,
  MediaStore,
  ProcessedMedia,
  StoredMediaVariant,
} from '../../src/server/modules/media/media.types.js';
import { imageReference, type ImageReference, type MediaVariant } from '../../src/shared/media.js';
import type { AccessUserRecord } from '../../src/server/modules/auth/auth.types.js';
import {
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';
import { safeImageFixture } from '../fixtures/media.js';

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

const user: AccessUserRecord = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Administradora',
  email: 'admin@fluair.test',
  passwordHash: 'hash:senha-correta',
  active: true,
  rolePermissions: ['catalog.manage', 'price.view'],
  permissionOverrides: [],
};

class InMemoryMediaStore implements MediaStore {
  assets = new Map<string, ProcessedMedia>();
  links = new Map<string, string>();
  audits: Array<Record<string, string | null>> = [];
  sequence = 0;

  async attach(
    entityType: MediaEntityType,
    entityId: string,
    media: ProcessedMedia,
    context: MediaMutationContext,
  ): Promise<ImageReference> {
    const id = `20000000-0000-4000-8000-${String(++this.sequence).padStart(12, '0')}`;
    const key = `${entityType}:${entityId}`;
    const previousAssetId = this.links.get(key) ?? null;
    this.assets.set(id, media);
    this.links.set(key, id);
    this.audits.push({
      actorUserId: context.actorUserId,
      entityType,
      entityId,
      previousAssetId,
      newAssetId: id,
      origin: context.origin,
      requestId: context.requestId,
    });
    return imageReference({ id, width: media.width, height: media.height, createdAt: new Date(0) });
  }

  async detach(
    entityType: MediaEntityType,
    entityId: string,
    context: MediaMutationContext,
  ): Promise<void> {
    const key = `${entityType}:${entityId}`;
    const previousAssetId = this.links.get(key) ?? null;
    this.links.delete(key);
    if (previousAssetId)
      this.audits.push({
        actorUserId: context.actorUserId,
        entityType,
        entityId,
        previousAssetId,
        newAssetId: null,
        origin: context.origin,
        requestId: context.requestId,
      });
  }

  async readVariant(assetId: string, variant: MediaVariant): Promise<StoredMediaVariant | null> {
    const asset = this.assets.get(assetId);
    if (!asset || ![...this.links.values()].includes(assetId)) return null;
    const data = variant === 'thumb' ? asset.thumbnailData : asset.displayData;
    return {
      data,
      mimeType: asset.mimeType,
      etag: `"${createHash('sha256').update(data).digest('hex')}"`,
    };
  }
}

function setup(access: AccessUserRecord = user) {
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
  const store = new InMemoryMediaStore();
  return {
    store,
    app: createApp({
      config: testConfig,
      logger: pino({ level: 'silent' }),
      authService,
      mediaService: new MediaService(store),
    }),
  };
}

async function agentFor(app: ReturnType<typeof createApp>, access: AccessUserRecord = user) {
  const agent = request.agent(app);
  await agent
    .post('/api/v1/auth/login')
    .set('Origin', testConfig.APP_URL)
    .send({ email: access.email, password: 'senha-correta' })
    .expect(200);
  return agent;
}

describe('API de mídia', () => {
  it('faz upload, serve variante autenticada e responde 304 pelo ETag', async () => {
    const context = setup();
    const agent = await agentFor(context.app);
    const entityId = '30000000-0000-4000-8000-000000000001';
    const uploaded = await agent
      .put(`/api/v1/media/products/${entityId}`)
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', 'image/png')
      .set('x-file-name', encodeURIComponent('produto.png'))
      .set('x-request-id', 'media-upload-test')
      .send(await safeImageFixture('png', 48, 24))
      .expect(200);

    expect(uploaded.body.data.image).toMatchObject({ width: 48, height: 24 });
    expect(uploaded.body.data.image).not.toHaveProperty('data');
    const assetId = uploaded.body.data.image.id as string;
    const image = await agent.get(`/api/v1/media/${assetId}/thumb`).expect(200);
    expect(image.headers['content-type']).toMatch(/^image\/webp/);
    expect(image.headers['cache-control']).toBe('private, max-age=31536000, immutable');
    expect(image.headers.etag).toBeTruthy();
    await agent
      .get(`/api/v1/media/${assetId}/thumb`)
      .set('If-None-Match', `W/${image.headers.etag as string}`)
      .expect(304);

    expect(context.store.audits[0]).toMatchObject({
      actorUserId: user.id,
      entityId,
      origin: 'PRODUCTS',
      requestId: 'media-upload-test',
    });
    expect(JSON.stringify(context.store.audits)).not.toContain('displayData');
    expect(JSON.stringify(context.store.audits)).not.toContain('thumbnailData');
  });

  it('remove somente o vínculo atual e deixa de expor ativo sem referência', async () => {
    const context = setup();
    const agent = await agentFor(context.app);
    const entityId = '30000000-0000-4000-8000-000000000002';
    const uploaded = await agent
      .put(`/api/v1/media/kits/${entityId}`)
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', 'image/png')
      .set('x-file-name', 'kit.png')
      .send(await safeImageFixture('png', 48, 24))
      .expect(200);
    const assetId = uploaded.body.data.image.id as string;

    await agent
      .delete(`/api/v1/media/kits/${entityId}`)
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'media-remove-test')
      .expect(204);
    expect(context.store.assets.has(assetId)).toBe(true);
    await agent.get(`/api/v1/media/${assetId}/display`).expect(404);
    expect(context.store.audits.at(-1)).toMatchObject({
      newAssetId: null,
      requestId: 'media-remove-test',
    });
  });

  it.each([
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'foto.svg', 'image/svg+xml'],
    ['arquivo falso', Buffer.from('não é PNG'), 'foto.png', 'image/png'],
    ['arquivo corrompido', Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'foto.jpg', 'image/jpeg'],
  ])('rejeita %s', async (_label, body, fileName, contentType) => {
    const context = setup();
    const agent = await agentFor(context.app);
    await agent
      .put('/api/v1/media/products/30000000-0000-4000-8000-000000000003')
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', contentType)
      .set('x-file-name', fileName)
      .send(body)
      .expect((response) => {
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.error.message).not.toContain(body.toString('base64'));
      });
    expect(context.store.assets.size).toBe(0);
  });

  it('protege mutação por catalog.manage e leitura por sessão/permissão coerente', async () => {
    const viewer: AccessUserRecord = {
      ...user,
      id: '10000000-0000-4000-8000-000000000002',
      email: 'sem-permissao@fluair.test',
      rolePermissions: ['calculation.history'],
    };
    const context = setup(viewer);
    const agent = await agentFor(context.app, viewer);
    await agent
      .put('/api/v1/media/products/30000000-0000-4000-8000-000000000004')
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', 'image/png')
      .set('x-file-name', 'produto.png')
      .send(await safeImageFixture('png', 48, 24))
      .expect(403);
    await agent.get('/api/v1/media/20000000-0000-4000-8000-000000000001/thumb').expect(403);
    await request(context.app)
      .get('/api/v1/media/20000000-0000-4000-8000-000000000001/thumb')
      .expect(401);
  });

  it('rejeita upload acima de 5 MB antes do processamento', async () => {
    const context = setup();
    const agent = await agentFor(context.app);
    await agent
      .put('/api/v1/media/products/30000000-0000-4000-8000-000000000005')
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', 'application/octet-stream')
      .set('x-file-name', 'grande.png')
      .send(Buffer.alloc(5 * 1024 * 1024 + 1))
      .expect(413);
    expect(context.store.assets.size).toBe(0);
  });
});
