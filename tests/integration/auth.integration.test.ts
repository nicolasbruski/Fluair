import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/server/app.js';
import type { AppConfig } from '../../src/server/config/env.js';
import { AuthService } from '../../src/server/modules/auth/auth.service.js';
import {
  activeUser,
  fakePasswordService,
  InMemoryAuthRepository,
} from '../helpers/in-memory-auth.repository.js';

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

function setup(appConfig: AppConfig = testConfig) {
  const repository = new InMemoryAuthRepository();
  repository.addUser(activeUser);
  const authService = new AuthService(repository, fakePasswordService, {
    secret: appConfig.SESSION_SECRET,
    sessionTtlMilliseconds: appConfig.SESSION_TTL_HOURS * 60 * 60 * 1_000,
    loginWindowMilliseconds: appConfig.LOGIN_WINDOW_MINUTES * 60 * 1_000,
    loginBlockMilliseconds: appConfig.LOGIN_BLOCK_MINUTES * 60 * 1_000,
    loginMaxAttempts: appConfig.LOGIN_MAX_ATTEMPTS,
    dummyPasswordHash: 'hash:dummy',
  });
  const app = createApp({
    config: appConfig,
    logger: pino({ level: 'silent' }),
    authService,
  });
  return { app, repository };
}

describe('API de autenticação', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('inicia, restaura e encerra uma sessão por cookie HttpOnly persistido no servidor', async () => {
    const agent = request.agent(context.app);
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(200);

    expect(loginResponse.body.data.user).toMatchObject({
      id: activeUser.id,
      email: activeUser.email,
      permissions: ['calculation.view', 'matrix.view'],
    });
    const cookie = loginResponse.headers['set-cookie']?.[0] as string | undefined;
    expect(cookie).toContain('fluair_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
    const rawToken = cookie?.match(/fluair_session=([^;]+)/)?.[1];
    expect(rawToken).toBeTruthy();
    expect([...context.repository.sessions.keys()]).not.toContain(rawToken);
    expect(loginResponse.headers['cache-control']).toBe('no-store');

    await agent
      .get('/api/v1/auth/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.user.email).toBe(activeUser.email);
      });
    const logoutResponse = await agent
      .post('/api/v1/auth/logout')
      .set('Origin', testConfig.APP_URL)
      .send({})
      .expect(200);
    const clearedCookie = logoutResponse.headers['set-cookie']?.[0] as string | undefined;
    expect(clearedCookie).toContain('fluair_session=;');
    expect(clearedCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    await agent
      .get('/api/v1/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe('AUTH_REQUIRED');
      });
  });

  it('marca o cookie como Secure no ambiente de produção', async () => {
    const productionConfig: AppConfig = {
      ...testConfig,
      NODE_ENV: 'production',
      APP_URL: 'https://fluair.example',
    };
    const production = setup(productionConfig);
    const response = await request(production.app)
      .post('/api/v1/auth/login')
      .set('Origin', productionConfig.APP_URL)
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(200);

    const cookie = response.headers['set-cookie']?.[0] as string | undefined;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('retorna erro genérico e nunca cria cookie com credenciais inválidas', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .send({ email: 'naoexiste@fluair.test', password: 'incorreta' })
      .expect(401);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha inválidos.',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('password');
  });

  it('valida a entrada com Zod e mantém o contrato de erro da API', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .set('x-request-id', 'integration-request')
      .send({ email: 'inválido', password: '' })
      .expect(400);
    expect(response.headers['x-request-id']).toBe('integration-request');
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      requestId: 'integration-request',
    });
    expect(response.body.error.fieldErrors.email).toBeDefined();
    expect(response.body.error.fieldErrors.password).toBeDefined();
  });

  it('trata JSON malformado como erro de entrada sem expor detalhes internos', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);

    expect(response.body.error).toMatchObject({
      code: 'INVALID_JSON',
      message: 'O corpo JSON da requisição é inválido.',
      fieldErrors: {},
    });
    expect(response.body.error.requestId).toBeTypeOf('string');
  });

  it('recusa corpos acima do limite com o status HTTP adequado', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .send({ email: activeUser.email, password: 'x'.repeat(33_000) })
      .expect(413);

    expect(response.body.error).toMatchObject({
      code: 'REQUEST_TOO_LARGE',
      message: 'A requisição excede o tamanho permitido.',
    });
    expect(context.repository.sessions.size).toBe(0);
  });

  it('bloqueia mutações originadas por outro site', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://site-malicioso.example')
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(context.repository.sessions.size).toBe(0);
  });

  it('aceita outra porta do frontend local somente em desenvolvimento', async () => {
    const development = setup({ ...testConfig, NODE_ENV: 'development' });
    await request(development.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5174')
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(200);

    const production = setup({
      ...testConfig,
      NODE_ENV: 'production',
      APP_URL: 'https://fluair.example',
    });
    await request(production.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://fluair.example:5174')
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('ORIGIN_NOT_ALLOWED'));
  });

  it('rejeita a origem antes de tentar interpretar o corpo da requisição', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://site-malicioso.example')
      .set('Content-Type', 'application/json')
      .send('{JSON inválido')
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('bloqueia mutações sem evidência de mesma origem', async () => {
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(context.repository.sessions.size).toBe(0);
  });

  it('aceita fetch de mesma origem quando o navegador omite o cabeçalho Origin', async () => {
    await request(context.app)
      .post('/api/v1/auth/login')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(200);
    expect(context.repository.sessions.size).toBe(1);
  });

  it('recusa uma conta desativada sem emitir cookie', async () => {
    context.repository.addUser({ ...activeUser, active: false });
    const response = await request(context.app)
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(403);
    expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('invalida a sessão existente assim que a conta é desativada', async () => {
    const agent = request.agent(context.app);
    await agent
      .post('/api/v1/auth/login')
      .set('Origin', testConfig.APP_URL)
      .send({ email: activeUser.email, password: 'senha-correta' })
      .expect(200);
    context.repository.addUser({ ...activeUser, active: false });

    await agent
      .get('/api/v1/auth/me')
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe('ACCOUNT_INACTIVE');
      });
    expect([...context.repository.sessions.values()][0]?.revokedAt).toBeInstanceOf(Date);
  });

  it('limita tentativas no backend e informa quando o cliente pode tentar novamente', async () => {
    let response: request.Response | undefined;
    for (let attempt = 0; attempt < testConfig.LOGIN_MAX_ATTEMPTS; attempt += 1) {
      response = await request(context.app)
        .post('/api/v1/auth/login')
        .set('Origin', testConfig.APP_URL)
        .send({ email: activeUser.email, password: 'incorreta' });
    }

    expect(response?.status).toBe(429);
    expect(response?.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(Number(response?.headers['retry-after'])).toBeGreaterThan(0);
    expect(context.repository.sessions.size).toBe(0);
  });
});
