import { expect, test } from '@playwright/test';

const calculationId = '50000000-0000-4000-8000-000000000001';
const productId = '70000000-0000-4000-8000-000000000002';
const customerId = '10000000-0000-4000-8000-000000000001';
const customer = {
  id: customerId,
  code: 'C01619',
  legalName: 'Expresso Figueiredo',
  cnpj: '12345678000199',
  city: 'São Paulo',
  state: 'SP',
  segment: null,
  customerClass: null,
  customerSegment: null,
  seller: null,
  representative: null,
  internalNote: null,
  orderNote: null,
  active: true,
  createdAt: '2026-09-20T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Usuária de Teste',
            email: 'usuario@fluair.test',
            roleCode: 'READ_ONLY',
            permissions: ['price.view', 'customer.view'],
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/saved-catalog**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/${calculationId}/composition`))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            kit: {
              calculationId,
              code: 'KIT-100',
              description: 'Kit condensador',
              customers: [
                {
                  id: customerId,
                  code: 'C01619',
                  legalName: 'Expresso Figueiredo',
                },
              ],
              items: [
                {
                  lineNumber: 1,
                  code: 'PROD-001',
                  description: 'Parafuso da composição',
                  quantity: '2.5000',
                  unit: 'UN',
                  minimumUnitPrice: '10.0000',
                  normalUnitPrice: '12.0000',
                  minimumTotal: '25.0000',
                  normalTotal: '30.0000',
                  hasPrice: true,
                },
              ],
            },
          },
        }),
      });
    return route.fallback();
  });
  await page.route('**/api/v1/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          items: [
            {
              kind: 'KIT',
              entityId: '80000000-0000-4000-8000-000000000001',
              code: 'KIT-100',
              description: 'Kit condensador',
              reference: 'REF-KIT-100',
              image: null,
              origins: [{ id: 'list-1', code: 'IMPL', name: 'Implementador' }],
              compositionCalculationId: calculationId,
              scope: 'CUSTOMER_SPECIFIC',
            },
            {
              kind: 'PRODUCT',
              entityId: productId,
              code: 'AVULSO-001',
              description: 'Produto com oferta ativa',
              reference: 'REF-001',
              image: null,
              origins: [{ id: 'list-2', code: 'VAREJO', name: 'Varejo' }],
            },
          ],
        },
        pagination: { page: 1, pageSize: 30, total: 2, totalPages: 1 },
      }),
    }),
  );
  await page.route('**/api/v1/customers**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/classifications'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customerClasses: [], customerSegments: [] } }),
      });
    if (path.endsWith(`/${customerId}/calculation-links`))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            customer: { id: customer.id, code: customer.code, legalName: customer.legalName },
            calculations: [],
          },
        }),
      });
    if (path.endsWith(`/${customerId}`))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer } }),
      });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [customer],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      }),
    });
  });
});

test('lista kits e produtos avulsos, mas mantém componentes somente na composição', async ({
  page,
}) => {
  await page.goto('/produtos');

  await expect(page.getByRole('heading', { name: 'Catálogo de produtos' })).toBeVisible();
  await expect(page.locator('#products-tbody')).toContainText('KIT-100');
  await expect(page.locator('#products-tbody')).toContainText('AVULSO-001');
  await expect(page.locator('#products-tbody')).toContainText('REF-KIT-100');
  await expect(page.locator('#products-tbody')).toContainText('REF-001');
  await expect(page.locator('#products-tbody')).not.toContainText('PROD-001');
  await expect(page.locator('#products-tbody')).toContainText('Sem foto');
  await expect(page.locator('#products-tbody').getByRole('button', { name: /foto/i })).toHaveCount(
    0,
  );

  await page.getByRole('button', { name: 'Composição' }).click();

  await expect(page.getByRole('dialog', { name: 'Composição do kit KIT-100' })).toBeVisible();
  await expect(page.locator('#products-composition-customers')).toContainText('C01619');
  await expect(page.locator('#products-composition-customers')).toContainText(
    'Expresso Figueiredo',
  );
  await expect(page.locator('#products-composition-body')).toContainText('PROD-001');
  await expect(page.locator('#products-composition-body')).toContainText('Parafuso da composição');

  await page.getByTitle('Visualizar cliente Expresso Figueiredo').click();

  await expect(page).toHaveURL(`/clientes?cliente=${customerId}&aba=kits`);
  await expect(page.locator('#customer-details-subtitle')).toHaveText(
    'C01619 · Expresso Figueiredo',
  );
  await expect(page.locator('#customer-links-modal')).toHaveClass(/open/);
});

test('valida a foto no layout responsivo e impede envio inválido', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Gestora',
            email: 'gestora@fluair.test',
            roleCode: 'ADMINISTRATOR',
            permissions: ['price.view', 'catalog.manage'],
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
  await page.goto('/produtos');
  await page.getByRole('button', { name: 'Adicionar foto' }).first().click();
  await page.locator('#products-photo-file').setInputFiles({
    name: 'vetor.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg/>'),
  });
  await expect(page.locator('#products-photo-state')).toContainText('JPEG, PNG ou WebP');
  await expect(page.locator('#products-photo-save')).toBeDisabled();
  await expect(page.locator('#products-photo-modal')).toBeVisible();
});
