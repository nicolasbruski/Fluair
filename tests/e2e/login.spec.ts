import { expect, test } from '@playwright/test';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Usuária de Teste',
  email: 'usuario@fluair.test',
  permissions: ['calculation.view'],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

test('impede abrir diretamente a fonte legada sem proteção', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } }),
    }),
  );

  await page.goto('/fluair-tabpreco-merge-pedidos.html');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('.login-logo')).toBeVisible();
  await expect(page.locator('.login-logo')).toHaveAttribute('src', '/Logo.jpg');
  await expect(page.getByRole('heading', { name: 'Sistema de Formação de Preço' })).toBeVisible();
  await expect(page.locator('#login-email')).toHaveValue('');

  const password = page.locator('#login-password');
  await expect(password).toHaveAttribute('type', 'password');
  await password.fill('senha-visível');
  await page.getByRole('button', { name: 'Exibir senha' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('senha-visível');
  await page.getByRole('button', { name: 'Ocultar senha' }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('valida, autentica, filtra o menu e encerra a sessão', async ({ page }) => {
  let authenticated = false;
  await page.route('**/api/v1/auth/**', async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint.endsWith('/me')) {
      await route.fulfill({
        status: authenticated ? 200 : 401,
        contentType: 'application/json',
        body: authenticated
          ? JSON.stringify({
              data: { user, session: { expiresAt: new Date(Date.now() + 60_000) } },
            })
          : JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } }),
      });
      return;
    }
    if (endpoint.endsWith('/login')) {
      authenticated = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { user, session: { expiresAt: new Date(Date.now() + 60_000) } },
        }),
      });
      return;
    }
    authenticated = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { loggedOut: true } }),
    });
  });

  await page.goto('/calculos?perfil=implementador&page=2');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole('heading', { name: 'Sistema de Formação de Preço' })).toBeVisible();
  await expect(page.getByRole('navigation')).toBeHidden();
  await expect(page.locator('#login-email')).toHaveValue('');
  await expect(page.locator('#login-password')).toHaveValue('');
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });

  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#login-email-error')).toHaveText('Informe o e-mail.');
  await expect(page.locator('#login-password-error')).toHaveText('Informe a senha.');

  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('senha-correta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/calculos\?perfil=implementador&page=2$/);
  await expect(page.getByRole('navigation').getByRole('link', { name: /Busca/ })).toBeVisible();
  await expect(page.locator('#app-nav .nav-logo img')).toBeVisible();
  await expect(page.locator('#app-nav .nav-logo img')).toHaveAttribute('src', '/Logo.jpg');
  await page.screenshot({ path: 'test-results/navbar-logo.png', fullPage: false });
  await expect(page.getByRole('navigation').getByRole('link', { name: /Usuários/ })).toBeHidden();
  await expect(page.locator('#login-password')).toHaveValue('');
  await expect(page.locator('#busca-table')).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/calculos\?perfil=implementador&page=2$/);
  await expect(page.getByRole('navigation').getByRole('link', { name: /Busca/ })).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('apresenta a mensagem segura para conta desativada', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } }),
    }),
  );
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Sua conta está desativada. Fale com o administrador.',
        },
      }),
    }),
  );

  await page.goto('/login');
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('senha-correta');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Sua conta está desativada. Fale com o administrador.',
  );
  await expect(page.locator('#login-password')).toHaveValue('');
});

test('diferencia indisponibilidade da API e acesso sem permissão', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço indisponível.' },
      }),
    }),
  );
  await page.goto('/login');
  await expect(page.getByRole('alert')).toHaveText(
    'O sistema está temporariamente indisponível. Tente novamente.',
  );

  await page.unroute('**/api/v1/auth/me');
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user, session: { expiresAt: new Date(Date.now() + 60_000).toISOString() } },
      }),
    }),
  );
  await page.goto('/usuarios');
  await expect(
    page.getByRole('heading', { name: 'Você não possui acesso a esta área' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: /Busca/ })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: /Usuários/ })).toBeHidden();
});

test('impede envio duplicado e ignora retorno externo', async ({ page }) => {
  let loginRequests = 0;
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } }),
    }),
  );
  await page.route('**/api/v1/auth/login', async (route) => {
    loginRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user, session: { expiresAt: new Date(Date.now() + 60_000).toISOString() } },
      }),
    });
  });

  await page.goto('/login?returnTo=%2F%2Fsite-malicioso.example');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('senha-correta');
  const submit = page.getByRole('button', { name: 'Entrar' });
  await submit.dblclick();

  await expect(page).toHaveURL(/\/calculos$/);
  expect(loginRequests).toBe(1);
});
