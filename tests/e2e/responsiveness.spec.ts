import { readFile } from 'node:fs/promises';

import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertNoDocumentHorizontalOverflow,
  assertNoUnexpectedApiFailures,
  auditApiFailures,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const calculationId = '50000000-0000-4000-8000-000000000001';
const session = { expiresAt: '2027-01-01T00:00:00.000Z' };
const allPermissions = [
  'calculation.view',
  'calculation.create',
  'calculation.history',
  'calculation.export',
  'order.access',
  'order.price-approval.manage',
  'price.view',
  'price.override',
  'catalog.manage',
  'customer.view',
  'customer.manage',
  'matrix.view',
  'matrix.manage',
  'commission.access',
  'user.view',
  'user.manage',
];

const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora de Responsividade',
  email: 'admin.responsividade@fluair.test',
  roleCode: 'ADMINISTRATOR',
  permissions: allPermissions,
};

const applicationRoutes = [
  { path: '/calculos', screen: '#s-busca' },
  { path: `/calculos/${calculationId}`, screen: '#s-detalhe' },
  { path: '/calculos/novo', screen: '#s-calc' },
  { path: '/pedidos/novo', screen: '#s-pedido' },
  { path: '/aprovacoes/precos', screen: '#s-aprovacoes' },
  { path: '/produtos', screen: '#s-produtos' },
  { path: '/clientes', screen: '#s-clientes' },
  { path: '/listas', screen: '#s-matriz' },
  { path: '/usuarios', screen: '#s-usuarios' },
];

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function blockExternalAssets(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await blockExternalAssets(page);
});

test('percorre todas as rotas em estado de erro sem falhas de API silenciosas', async ({
  page,
}, testInfo) => {
  const audit = auditApiFailures(
    page,
    (response) => response.status() === 503 && !response.url().endsWith('/auth/me'),
  );
  await page.route('**/api/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/me') return json(route, { data: { user: admin, session } });
    return json(
      route,
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Indisponibilidade controlada.' } },
      503,
    );
  });

  const violations: string[] = [];
  for (const route of applicationRoutes) {
    await test.step(route.path, async () => {
      await page.goto(route.path);
      await expect(page.locator(route.screen)).toBeVisible();
      await captureResponsiveScreenshot(page, testInfo, { route: route.path, state: 'erro' });
      try {
        await assertNoDocumentHorizontalOverflow(page);
      } catch (error) {
        violations.push(`${route.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  audit.stop();
  assertNoUnexpectedApiFailures(audit);
  expect(violations, violations.join('\n\n')).toEqual([]);
});

test('cobre estado vazio autenticado e navegação com permissão reduzida', async ({
  page,
}, testInfo) => {
  const audit = auditApiFailures(page);
  let reducedPermissions = false;
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/auth/me') {
      return json(route, {
        data: {
          user: reducedPermissions
            ? { ...admin, roleCode: 'READ_ONLY', permissions: ['calculation.view'] }
            : admin,
          session,
        },
      });
    }
    if (url.pathname === '/api/v1/calculations') {
      return json(route, {
        data: {
          calculations: [],
          filters: { priceLists: [] },
          pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
        },
      });
    }
    if (url.pathname.endsWith('/count')) return json(route, { data: { pending: 0 } });
    if (url.pathname.includes('/order-price-approvals/')) {
      return json(route, {
        data: [],
        pagination: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
      });
    }
    return json(route, { error: { code: 'UNMOCKED_API', message: url.pathname } }, 501);
  });

  await page.goto('/calculos');
  await expect(page.locator('#busca-count')).toHaveText('0 cálculos encontrados');
  await expect(page.getByText('Nenhum cálculo encontrado')).toBeVisible();
  await assertElementWithinViewport(page.locator('#busca-q'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, { route: '/calculos', state: 'vazio' });

  reducedPermissions = true;
  await page.reload();
  await page.goto('/usuarios');
  await expect(page.locator('#s-forbidden')).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link', { name: /Usuários/ })).toBeHidden();
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/usuarios',
    state: 'sem-permissao',
  });

  audit.stop();
  assertNoUnexpectedApiFailures(audit);
});

test('cobre login, API indisponível e o módulo externo de Comissões', async ({
  page,
}, testInfo) => {
  let unavailable = false;
  const audit = auditApiFailures(
    page,
    (response) => unavailable && response.url().endsWith('/auth/me') && response.status() === 503,
  );
  await page.route('**/api/v1/auth/me', (route) =>
    json(
      route,
      unavailable
        ? { error: { code: 'SERVICE_UNAVAILABLE', message: 'Indisponibilidade controlada.' } }
        : { error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } },
      unavailable ? 503 : 401,
    ),
  );

  await page.goto('/login');
  await expect(page.locator('#s-login')).toBeVisible();
  await assertNoDocumentHorizontalOverflow(page);
  await assertElementWithinViewport(page.getByRole('button', { name: 'Entrar' }));
  await captureResponsiveScreenshot(page, testInfo, { route: '/login', state: 'carregado' });

  unavailable = true;
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('temporariamente indisponível');
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, { route: '/login', state: 'erro-api' });

  const commissionsSource = await readFile('Comissoes/sistema_comissao_v3.html', 'utf8');
  await page.route('**/comissoes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: commissionsSource,
    }),
  );
  await page.route('**/api/v1/commissions/customers', (route) =>
    json(route, { data: { customers: [] } }),
  );
  await page.route('**/comissoes/imagem/Logo.jpg', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await page.goto('/comissoes');
  await expect(page.locator('body')).toBeVisible();
  await captureResponsiveScreenshot(page, testInfo, { route: '/comissoes', state: 'carregado' });
  await assertNoDocumentHorizontalOverflow(page);

  audit.stop();
  const expectedAuthenticationFailures = audit.failures.filter(
    (failure) => !failure.includes('401') || !failure.includes('/auth/me'),
  );
  expect(expectedAuthenticationFailures, expectedAuthenticationFailures.join('\n')).toEqual([]);
});
