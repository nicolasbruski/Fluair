import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const allPermissions = [
  'calculation.view',
  'calculation.create',
  'order.access',
  'order.price-approval.manage',
  'price.view',
  'catalog.manage',
  'customer.view',
  'customer.manage',
  'matrix.view',
  'matrix.manage',
  'commission.access',
  'user.view',
  'user.manage',
];

const administrator = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora com um nome excepcionalmente longo para validar a navegação compacta',
  email: 'administradora.com.email.extenso@departamento-interno.fluair.test',
  permissions: allPermissions,
};

const roles = [
  {
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acesso total.',
    permissions: allPermissions,
  },
  {
    code: 'CALCULATION_OPERATOR',
    name: 'Operador de cálculo',
    description: 'Calcula e consulta.',
    permissions: ['calculation.view', 'calculation.create'],
  },
];

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockAuthenticatedApplication(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/me') {
      return json(route, {
        data: { user: administrator, session: { expiresAt: '2027-01-01T00:00:00.000Z' } },
      });
    }
    if (pathname === '/api/v1/users') {
      return json(route, {
        data: {
          users: [
            {
              ...administrator,
              active: true,
              role: { code: 'ADMINISTRATOR', name: 'Administrador' },
              createdAt: '2026-10-18T12:00:00.000Z',
              updatedAt: '2026-10-18T12:00:00.000Z',
            },
            {
              id: '00000000-0000-4000-8000-000000000002',
              name: 'Usuária com nome de cento e vinte caracteres que permanece completamente legível mesmo dentro de um cartão bastante estreito',
              email:
                'usuario.com.endereco.muito.longo@subdominio-corporativo-excepcionalmente-extenso.fluair.test',
              active: false,
              role: { code: 'CALCULATION_OPERATOR', name: 'Operador de cálculo' },
              permissions: ['calculation.view', 'calculation.create'],
              createdAt: '2026-10-18T12:00:00.000Z',
              updatedAt: '2026-10-18T12:00:00.000Z',
            },
          ],
          roles,
        },
      });
    }
    if (pathname.endsWith('/count')) return json(route, { data: { pending: 0 } });
    if (pathname.includes('/order-price-approvals')) {
      return json(route, {
        data: [],
        pagination: { page: 1, pageSize: 3, total: 0, totalPages: 0 },
      });
    }
    return json(route, { data: {} });
  });
}

test.beforeEach(async ({ page }) => mockAuthenticatedApplication(page));

test('mantém todos os destinos e controles de sessão alcançáveis', async ({ page }, testInfo) => {
  await page.goto('/usuarios');
  const viewport = page.viewportSize();
  const toggle = page.locator('#nav-menu-toggle');
  const menu = page.locator('#nav-menu');

  if ((viewport?.width ?? 0) <= 1024) {
    await expect(toggle).toBeVisible();
    await assertMinimumInteractiveArea(toggle);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveClass(/is-open/);
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(menuBox!.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 59);
    for (const label of [
      'Busca',
      'Calcular',
      'Pedidos',
      'Produtos',
      'Clientes',
      'Listas de Preço',
      'Comissões',
      'Usuários',
    ]) {
      await expect(menu.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(menu.getByRole('link', { name: 'Usuários' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('#admin-approvals-notification-button')).toBeVisible();
    await assertMinimumInteractiveArea(page.locator('#admin-approvals-notification-button'));
    await assertElementWithinViewport(page.locator('#logout-button'));
    await assertMinimumInteractiveArea(page.locator('#logout-button'));
    await captureResponsiveScreenshot(page, testInfo, {
      route: '/usuarios',
      state: 'menu-aberto',
    });
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  } else {
    await expect(toggle).toBeHidden();
    await expect(menu.getByRole('link', { name: 'Usuários' })).toBeVisible();
  }

  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/usuarios',
    state: 'navegacao',
  });

  if (testInfo.project.name === 'desktop') {
    await test.step('reflow equivalente a 200% em uma janela de 1280 px', async () => {
      await page.setViewportSize({ width: 640, height: 450 });
      await expect(toggle).toBeVisible();
      await toggle.click();
      await assertElementWithinViewport(page.locator('#logout-button'));
      await assertNoDocumentHorizontalOverflow(page);
      await page.keyboard.press('Escape');
    });
  }
});

test('apresenta usuários longos, perfis e modais sem corte', async ({ page }, testInfo) => {
  await page.goto('/usuarios');
  const rows = page.locator('.user-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).getByText('Desativado')).toBeVisible();
  await expect(rows.nth(1).getByText('Operador de cálculo')).toBeVisible();
  await expect(rows.nth(1).getByText('2 permissões efetivas')).toBeVisible();
  await assertNoDocumentHorizontalOverflow(page);

  const editButton = rows.nth(1).getByRole('button', { name: 'Editar' });
  await assertElementWithinViewport(editButton);
  await assertMinimumInteractiveArea(editButton);
  await editButton.click();
  const modal = page.locator('#modal-editar-usuario .modal');
  await assertElementWithinViewport(modal);
  await assertElementWithinViewport(modal.getByRole('button', { name: 'Salvar alterações' }));
  await page.keyboard.press('Escape');
  await expect(editButton).toBeFocused();
  await expect(page.locator('#modal-editar-usuario')).not.toHaveClass(/open/);

  const statusButton = rows.nth(1).getByRole('button', { name: 'Ativar' });
  await statusButton.click();
  const statusModal = page.locator('#modal-status-usuario .modal');
  await assertElementWithinViewport(statusModal);
  await assertElementWithinViewport(statusModal.getByRole('button', { name: 'Ativar usuário' }));
  await page.keyboard.press('Escape');
  await expect(statusButton).toBeFocused();

  const roleCells = page.locator('.users-roles-table tbody tr').first().locator('td');
  await expect(roleCells.nth(0)).toHaveAttribute('data-label', 'Perfil');
  await expect(roleCells.nth(1)).toHaveAttribute('data-label', 'Permissões');
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/usuarios',
    state: 'usuarios-longos',
  });
});

test('filtra a navegação de uma sessão com permissões reduzidas', async ({ page }) => {
  await page.unroute('**/api/v1/**');
  await page.route('**/api/v1/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/v1/auth/me') {
      return json(route, {
        data: {
          user: { ...administrator, permissions: ['calculation.view'] },
          session: { expiresAt: '2027-01-01T00:00:00.000Z' },
        },
      });
    }
    if (pathname === '/api/v1/calculations') {
      return json(route, {
        data: {
          calculations: [],
          filters: { priceLists: [] },
          pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
        },
      });
    }
    return json(route, { data: {} });
  });

  await page.goto('/calculos');
  const toggle = page.locator('#nav-menu-toggle');
  if (await toggle.isVisible()) await toggle.click();
  const permittedLinks = page.locator('#nav-menu .nav-links a:not([hidden])');
  await expect(permittedLinks).toHaveCount(1);
  await expect(permittedLinks).toHaveText('Busca');
  await assertElementWithinViewport(page.locator('#logout-button'));
  await assertNoDocumentHorizontalOverflow(page);
});

test('mantém login e estados de autenticação utilizáveis em baixa altura', async ({
  page,
}, testInfo) => {
  await page.unroute('**/api/v1/**');
  await page.route('**/api/v1/auth/me', (route) =>
    json(
      route,
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.' } },
      503,
    ),
  );
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('temporariamente indisponível');
  await assertElementWithinViewport(page.locator('#login-email'));
  await assertElementWithinViewport(page.locator('#login-password'));
  await assertElementWithinViewport(page.locator('#login-submit'));
  await assertMinimumInteractiveArea(page.locator('#login-submit'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, { route: '/login', state: 'baixa-altura' });
});
