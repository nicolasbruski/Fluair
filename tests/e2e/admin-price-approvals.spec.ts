import { expect, test } from '@playwright/test';

const admin = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Administrador',
  email: 'admin@fluair.test',
  permissions: ['order.price-approval.manage'],
};

const item = {
  lineNumber: 1,
  kind: 'STANDALONE_PRODUCT',
  requiresApproval: true,
  sourceProductId: '00000000-0000-4000-8000-000000000020',
  sourceKitId: null,
  sourceCalculationVersionId: null,
  sourcePriceListVersionId: '00000000-0000-4000-8000-000000000021',
  priceList: {
    id: '00000000-0000-4000-8000-000000000022',
    code: 'PADRAO',
    name: 'Lista padrão',
    type: 'STANDALONE_PRODUCT',
    version: 3,
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 10,
  },
  calculationVersion: null,
  priceReference: 'UNIT',
  code: '703100',
  description: 'Produto em condição especial',
  reference: 'REF-1',
  unit: 'UN',
  quantity: '2.0000',
  referenceUnitPrice: '100.0000',
  minimumUnitPrice: '100.0000',
  negotiatedUnitPrice: '90.0000',
  minimumSubtotal: '200.0000',
  negotiatedSubtotal: '180.0000',
  exceptionUnitAmount: '10.0000',
  exceptionTotalAmount: '20.0000',
  ipiRate: null,
  icmsRate: null,
};

function approval(status: 'PENDING' | 'APPROVED' = 'PENDING') {
  return {
    id: '00000000-0000-4000-8000-000000000030',
    status,
    requester: {
      id: '00000000-0000-4000-8000-000000000031',
      name: 'Vendedora',
      email: 'vendedora@fluair.test',
    },
    customer: {
      id: '00000000-0000-4000-8000-000000000032',
      code: 'CLI-1',
      legalName: 'Cliente Industrial Ltda.',
      customerClass: null,
      customerSegment: null,
    },
    requestedAt: '2026-10-01T15:00:00.000Z',
    updatedAt: '2026-10-01T15:00:00.000Z',
    totalQuantity: '2.0000',
    minimumTotalAmount: '200.0000',
    requestedTotalAmount: '180.0000',
    exceptionAmount: '20.0000',
    itemCount: 1,
    exceptionCount: 1,
    decision:
      status === 'APPROVED'
        ? {
            reviewer: admin,
            note: 'Condição aprovada.',
            reviewedAt: '2026-10-01T16:00:00.000Z',
            approvedUntil: '2026-10-08T16:00:00.000Z',
          }
        : null,
    consumedOrder: null,
    version: status === 'APPROVED' ? 2 : 1,
  };
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

test('exibe badge, analisa detalhes e confirma uma decisão', async ({ page }) => {
  let status: 'PENDING' | 'APPROVED' = 'PENDING';
  let countRequests = 0;
  let approveBody: unknown;
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user: admin, session: { expiresAt: '2026-10-01T22:00:00.000Z' } },
      }),
    }),
  );
  await page.route('**/api/v1/order-price-approvals/admin**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith('/count')) {
      countRequests += 1;
      await route.fulfill({ json: { data: { pending: status === 'PENDING' ? 1 : 0 } } });
      return;
    }
    if (pathname.endsWith('/approve')) {
      approveBody = request.postDataJSON();
      status = 'APPROVED';
      await route.fulfill({
        json: {
          data: {
            ...approval(status),
            justification: 'Negociação estratégica.',
            items: [item],
            consumedAt: null,
          },
        },
      });
      return;
    }
    if (pathname.endsWith(approval().id)) {
      await route.fulfill({
        json: {
          data: {
            ...approval(status),
            justification: 'Negociação estratégica.',
            items: [item],
            consumedAt: null,
          },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: [{ ...approval(status), waitingSeconds: 3600 }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    });
  });

  await page.goto('/aprovacoes/precos');
  const navLink = page.getByRole('navigation').getByRole('link', { name: /Aprovações/ });
  await expect(navLink).toBeVisible();
  await expect(page.locator('#admin-approvals-badge')).toHaveText('1');
  await expect(page.getByText('Cliente Industrial Ltda.')).toBeVisible();
  await page.getByRole('button', { name: 'Analisar' }).click();
  await expect(page.getByRole('dialog', { name: 'Detalhe da solicitação' })).toContainText(
    'Negociação estratégica.',
  );
  await expect(page.getByRole('dialog', { name: 'Detalhe da solicitação' })).toContainText(
    'Abaixo do mínimo',
  );

  await page.getByRole('button', { name: 'Reprovar' }).click();
  const rejectDialog = page.getByRole('dialog', { name: 'Confirmar reprovação' });
  await rejectDialog.getByRole('button', { name: 'Confirmar reprovação' }).click();
  await expect(rejectDialog.getByLabel('Motivo da reprovação')).toBeFocused();
  await rejectDialog.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Aprovar' }).click();
  const approveDialog = page.getByRole('dialog', { name: 'Confirmar aprovação' });
  await approveDialog.getByLabel('Observação (opcional)').fill('Condição aprovada.');
  await approveDialog.getByRole('button', { name: 'Confirmar aprovação' }).click();
  await expect(page.getByText('Solicitação aprovada com sucesso.')).toBeVisible();
  await expect(page.locator('#admin-approvals-badge')).toBeHidden();
  expect(approveBody).toEqual({ expectedVersion: 1, note: 'Condição aprovada.' });
  expect(countRequests).toBeGreaterThanOrEqual(2);
});

test('oculta a capacidade e bloqueia a rota sem permissão', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: { ...admin, permissions: ['order.access'] },
          session: { expiresAt: '2026-10-01T22:00:00.000Z' },
        },
      }),
    }),
  );
  await page.goto('/aprovacoes/precos');
  await expect(
    page.getByRole('heading', { name: 'Você não possui acesso a esta área' }),
  ).toBeVisible();
  await expect(page.locator('#admin-approvals-nav-link')).toBeHidden();
});

test('mantém a fila utilizável em tela móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      json: { data: { user: admin, session: { expiresAt: '2026-10-01T22:00:00.000Z' } } },
    }),
  );
  await page.route('**/api/v1/order-price-approvals/admin/count', (route) =>
    route.fulfill({ json: { data: { pending: 1 } } }),
  );
  await page.route('**/api/v1/order-price-approvals/admin?**', (route) =>
    route.fulfill({
      json: {
        data: [{ ...approval(), waitingSeconds: 3600 }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      },
    }),
  );
  await page.goto('/aprovacoes/precos');
  await expect(page.getByRole('button', { name: 'Analisar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
