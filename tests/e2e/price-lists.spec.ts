import { expect, test, type Page } from '@playwright/test';

const classImplementer = {
  id: '10000000-0000-4000-8000-000000000001',
  code: 'IMPLEMENTER',
  name: 'Implementador',
  active: true,
};
const segmentDistributor = {
  id: '10000000-0000-4000-8000-000000000002',
  code: 'DISTRIBUTOR',
  name: 'Distribuidor',
  active: true,
};
const kitListId = '20000000-0000-4000-8000-000000000001';
const productListId = '20000000-0000-4000-8000-000000000002';

function version(number: number) {
  return {
    id: `30000000-0000-4000-8000-00000000000${number}`,
    version: number,
    fileName: `componentes-v${number}.xlsx`,
    fileSize: 2048,
    fileHash: String(number).repeat(64),
    itemCount: number * 10,
    importedBy: 'Administradora de Preços',
    createdAt: '2026-09-13T12:00:00.000Z',
  };
}

function priceLists(
  activeVersion = version(2),
  standaloneVersion: ReturnType<typeof version> | null = null,
) {
  return [
    {
      id: productListId,
      code: 'DISTRIBUIDOR_100',
      name: 'Produtos Distribuidor 100+',
      type: 'STANDALONE_PRODUCT',
      active: Boolean(standaloneVersion),
      minimumOrderQuantity: 100,
      maximumOrderQuantity: null,
      customerClasses: [],
      customerSegments: [segmentDistributor],
      activeVersion: standaloneVersion,
      versions: standaloneVersion ? [standaloneVersion] : [],
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
    },
    {
      id: kitListId,
      code: 'KIT_IMPLEMENTADOR',
      name: 'Componentes para Implementadores',
      type: 'KIT_COMPONENT',
      active: true,
      minimumOrderQuantity: null,
      maximumOrderQuantity: null,
      customerClasses: [classImplementer],
      customerSegments: [],
      activeVersion,
      versions: activeVersion ? [activeVersion] : [],
      createdAt: '2026-09-01T12:00:00.000Z',
      updatedAt: '2026-09-01T12:00:00.000Z',
    },
  ];
}

async function mockSession(
  page: Page,
  permissions = ['matrix.view', 'matrix.manage', 'customer.view'],
): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Administradora de Preços',
            email: 'admin@fluair.test',
            permissions,
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
}

test('admin visualiza em modal a estrutura persistida da versão ativa', async ({ page }) => {
  await mockBase(page);
  await page.route(`**/api/v1/price-lists/${kitListId}/active-version/structure**`, (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('page')).toBe('1');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          priceList: {
            id: kitListId,
            code: 'KIT_IMPLEMENTADOR',
            name: 'Componentes para Implementadores',
            type: 'KIT_COMPONENT',
          },
          version: version(2),
          items: [
            {
              code: 'COMP-001',
              description: 'Componente persistido',
              minimumPrice: '12.34',
              normalPrice: '15.67',
              reference: null,
              unitPrice: null,
              ipiRate: null,
              ipiIncluded: null,
              sourceRow: 8,
            },
          ],
        },
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    });
  });
  await page.goto('/listas');

  await page
    .locator(`[data-price-list="${kitListId}"]`)
    .getByRole('button', { name: 'Ver estrutura carregada' })
    .click();

  const modal = page.locator('#price-list-structure-modal');
  await expect(modal).toHaveClass(/open/);
  await expect(modal).toContainText('Componentes para Implementadores');
  await expect(modal).toContainText('versão v2');
  await expect(modal).toContainText('COMP-001');
  await expect(modal).toContainText('Componente persistido');
  await expect(modal).toContainText('R$ 12,34');
  await expect(modal.locator('tbody td').nth(3)).toHaveCSS('text-align', 'center');
  await expect(modal.locator('tbody td').nth(4)).toHaveCSS('text-align', 'center');
});

test('exibe IPI e ICMS de produto sem estrutura na escala percentual recebida', async ({
  page,
}) => {
  const productVersion = version(1);
  await mockBase(page, () => priceLists(version(2), productVersion));
  await page.route(`**/api/v1/price-lists/${productListId}/active-version/structure**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          priceList: {
            id: productListId,
            code: 'DISTRIBUIDOR_100',
            name: 'Produtos Distribuidor 100+',
            type: 'STANDALONE_PRODUCT',
          },
          version: productVersion,
          items: [
            {
              code: 'PROD-001',
              description: 'Produto sem estrutura',
              minimumPrice: null,
              normalPrice: null,
              reference: 'REF-001',
              unitPrice: '123.45',
              ipiRate: '3.25',
              icmsRate: '12',
              ipiIncluded: true,
              sourceRow: 2,
            },
          ],
        },
        pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
      }),
    }),
  );
  await page.goto('/listas');

  await page
    .locator(`[data-price-list="${productListId}"]`)
    .getByRole('button', { name: 'Ver estrutura carregada' })
    .click();

  const row = page.locator('#price-list-structure-modal tbody tr');
  await expect(row.locator('td').nth(5)).toHaveText('3,25%');
  await expect(row.locator('td').nth(6)).toHaveText('12%');
});

async function mockBase(page: Page, getLists = () => priceLists()): Promise<void> {
  await mockSession(page);
  await page.route('**/api/v1/customers/classifications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customerClasses: [classImplementer],
          customerSegments: [segmentDistributor],
        },
      }),
    }),
  );
  await page.route('**/api/v1/price-lists', (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { priceLists: getLists() } }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

test('renderiza listas dinâmicas na seção correta com público, faixa, situação e versão', async ({
  page,
}) => {
  await mockBase(page);
  await page.goto('/listas');

  const screen = page.locator('#s-matriz');
  const kits = screen.locator('[data-price-list-section="kits"]');
  const products = screen.locator('[data-price-list-section="products"]');
  await expect(kits).toContainText('Componentes para Implementadores');
  await expect(kits).toContainText('Implementador');
  await expect(kits).toContainText('v2 · componentes-v2.xlsx · 20 itens');
  await expect(products).toContainText('Produtos Distribuidor 100+');
  await expect(products).toContainText('Distribuidor');
  await expect(products).toContainText('A partir de 100 unidades');
  await expect(products).toContainText('Inativa');
  await expect(products).toContainText('Nenhuma versão ativa');
});

test('cria e edita a definição oferecendo somente o público compatível com o tipo', async ({
  page,
}) => {
  let createdBody: Record<string, unknown> | undefined;
  let updatedBody: Record<string, unknown> | undefined;
  await mockBase(page);
  await page.route('**/api/v1/price-lists', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    createdBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { priceList: priceLists()[0] } }),
    });
  });
  await page.route(`**/api/v1/price-lists/${kitListId}`, async (route) => {
    updatedBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'PRICE_LIST_RANGE_INVERTED',
          message: 'A faixa informada conflita com outra lista.',
        },
      }),
    });
  });
  await page.goto('/listas');

  await page.getByRole('button', { name: '+ Nova lista' }).click();
  const modal = page.locator('#price-list-form-modal');
  await modal.getByLabel('Tipo').selectOption('STANDALONE_PRODUCT');
  await expect(modal.getByText('Segmentos de clientes')).toBeVisible();
  await expect(modal.getByText('Distribuidor', { exact: true })).toBeVisible();
  await expect(modal.getByText('Implementador', { exact: true })).toHaveCount(0);
  await modal.getByLabel('Código').fill('varejo_100');
  await modal.getByLabel('Nome').fill('Varejo 100+');
  await modal.getByLabel('Quantidade mínima').fill('100');
  await modal.getByText('Distribuidor', { exact: true }).click();
  await modal.getByRole('button', { name: 'Criar lista' }).click();

  await expect
    .poll(() => createdBody)
    .toMatchObject({
      code: 'VAREJO_100',
      type: 'STANDALONE_PRODUCT',
      customerClassIds: [],
      customerSegmentIds: [segmentDistributor.id],
      minimumOrderQuantity: 100,
      maximumOrderQuantity: null,
    });

  await page
    .locator(`[data-price-list="${kitListId}"]`)
    .getByRole('button', { name: 'Editar definição' })
    .click();
  await expect(modal.getByLabel('Tipo')).toBeDisabled();
  await expect(modal.getByText('Classes de clientes')).toBeVisible();
  await modal.getByLabel('Nome').fill('Componentes revisados');
  await modal.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(modal.getByRole('alert')).toContainText(
    'A faixa informada conflita com outra lista.',
  );
  expect(updatedBody).toMatchObject({
    name: 'Componentes revisados',
    customerClassIds: [classImplementer.id],
    customerSegmentIds: [],
  });
});

test('prévia não ativa a versão e exige confirmação explícita, preservando erro recuperável', async ({
  page,
}) => {
  let confirmed = 0;
  let activeVersion = version(2);
  await mockBase(page, () => priceLists(activeVersion));
  await page.route(`**/api/v1/price-lists/${kitListId}/import/preview`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          preview: {
            priceList: {
              id: kitListId,
              code: 'KIT_IMPLEMENTADOR',
              name: 'Componentes para Implementadores',
              type: 'KIT_COMPONENT',
            },
            fileName: 'nova.xlsx',
            fileSize: 4,
            fileHash: 'f'.repeat(64),
            valid: true,
            itemCount: 35,
            errors: [],
            warnings: [
              {
                severity: 'WARNING',
                code: 'EMPTY_DESCRIPTION',
                message: 'Descrição vazia.',
                row: 8,
              },
            ],
          },
        },
      }),
    }),
  );
  await page.route(`**/api/v1/price-lists/${kitListId}/import/confirm`, async (route) => {
    confirmed += 1;
    expect(route.request().headers()['x-expected-file-hash']).toBe('f'.repeat(64));
    if (confirmed === 1) {
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'PRICE_LIST_FILE_DUPLICATE',
            message: 'Este arquivo já foi importado nesta lista.',
          },
        }),
      });
    }
    activeVersion = version(3);
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { imported: { priceListId: kitListId, version: activeVersion, warnings: [] } },
      }),
    });
  });
  await page.goto('/listas');

  const card = page.locator(`[data-price-list="${kitListId}"]`);
  await card.locator('input[type="file"]').setInputFiles({
    name: 'nova.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('xlsx'),
  });
  await card.getByRole('button', { name: 'Analisar arquivo' }).click();
  await expect(card.getByText('35 itens válidos')).toBeVisible();
  await expect(card.getByText('1 aviso(s)')).toBeVisible();
  expect(confirmed).toBe(0);
  await expect(card).toContainText('v2 · componentes-v2.xlsx · 20 itens');

  await card.getByRole('button', { name: 'Confirmar importação e ativar' }).click();
  await expect(card.getByRole('alert')).toContainText('Este arquivo já foi importado nesta lista.');
  await card.getByRole('button', { name: 'Confirmar importação e ativar' }).click();
  await expect(page.locator(`[data-price-list="${kitListId}"]`)).toContainText(
    'v3 · componentes-v3.xlsx · 30 itens',
  );
  expect(confirmed).toBe(2);
});
