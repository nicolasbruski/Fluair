import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const kitListId = '20000000-0000-4000-8000-000000000001';
const calculationId = '50000000-0000-4000-8000-000000000001';
const longDescription =
  'Kit condensador com descrição excepcionalmente longa, referência internacional e aplicação industrial que precisa quebrar sem ampliar o documento';

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

function pagination(total = 1, totalPages = 1) {
  return { page: 1, pageSize: 30, total, totalPages };
}

async function mockApplication(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    if (pathname === '/api/v1/auth/me') {
      return json(route, {
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Administradora responsiva',
            email: 'admin@fluair.test',
            permissions: [
              'calculation.view',
              'price.view',
              'catalog.manage',
              'matrix.view',
              'matrix.manage',
            ],
          },
          session: { expiresAt: '2027-01-01T00:00:00.000Z' },
        },
      });
    }
    if (pathname.startsWith('/api/v1/media/')) {
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    }
    if (pathname === '/api/v1/calculations') {
      return json(route, {
        data: {
          calculations: [
            {
              id: calculationId,
              kitCode: 'KIT-CODIGO-MUITO-LONGO-001',
              kitDescription: longDescription,
              reference: 'REFERENCIA-COMERCIAL-EXTENSA-SEM-ESPACOS-0000000001',
              priceList: { id: kitListId, code: 'IMPLEMENTER', name: 'Implementador nacional' },
              minimumTotal: '123456789.1200',
              normalTotal: '223456789.3400',
              version: 1,
              createdAt: '2026-10-18T12:00:00.000Z',
              createdBy: 'Usuária com nome operacional muito longo',
              current: true,
              image: {
                id: '70000000-0000-4000-8000-000000000001',
                thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
                displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
                width: 1200,
                height: 900,
                updatedAt: '2026-10-18T12:00:00.000Z',
              },
            },
          ],
          filters: {
            priceLists: [{ id: kitListId, code: 'IMPLEMENTER', name: 'Implementador nacional' }],
          },
          pagination: pagination(),
        },
      });
    }
    if (pathname === '/api/v1/catalog') {
      return json(route, {
        data: {
          items: [
            {
              kind: 'KIT',
              entityId: '80000000-0000-4000-8000-000000000001',
              code: 'KIT-CODIGO-MUITO-LONGO-001',
              description: longDescription,
              reference: 'REFERENCIA-TECNICA-EXTENSA-00000000000001',
              image: null,
              origins: [{ id: kitListId, code: 'IMPL', name: 'Origem comercial extensa' }],
              compositionCalculationId: calculationId,
              scope: 'GLOBAL',
            },
          ],
        },
        pagination: pagination(),
      });
    }
    if (pathname.endsWith(`/${calculationId}/composition`)) {
      return json(route, {
        data: {
          kit: {
            calculationId,
            code: 'KIT-CODIGO-MUITO-LONGO-001',
            description: longDescription,
            customers: [],
            items: [
              {
                lineNumber: 1,
                code: 'COMPONENTE-0000000001',
                description: longDescription,
                quantity: '9999.5000',
                unit: 'UN',
                minimumUnitPrice: '12345.6700',
                normalUnitPrice: '23456.7800',
                minimumTotal: '123450.0000',
                normalTotal: '234560.0000',
                hasPrice: true,
              },
            ],
          },
        },
      });
    }
    if (pathname === '/api/v1/customers/classifications') {
      return json(route, {
        data: {
          customerClasses: [
            { id: 'class-1', code: 'IMPLEMENTER', name: 'Implementador nacional', active: true },
          ],
          customerSegments: [],
        },
      });
    }
    if (pathname === '/api/v1/price-lists') {
      return json(route, {
        data: {
          priceLists: [
            {
              id: kitListId,
              code: 'KIT_IMPLEMENTADOR_COM_CODIGO_EXTENSO',
              name: 'Componentes para implementadores com denominação comercial muito extensa',
              type: 'KIT_COMPONENT',
              active: true,
              minimumOrderQuantity: null,
              maximumOrderQuantity: null,
              customerClasses: [
                {
                  id: 'class-1',
                  code: 'IMPLEMENTER',
                  name: 'Implementador nacional com classificação extensa',
                  active: true,
                },
              ],
              customerSegments: [],
              activeVersion: {
                id: 'version-1',
                version: 12,
                fileName: 'estrutura-com-nome-de-arquivo-excepcionalmente-longo.xlsx',
                fileSize: 2048,
                fileHash: '1'.repeat(64),
                itemCount: 120,
                importedBy: 'Administradora responsiva',
                createdAt: '2026-10-18T12:00:00.000Z',
              },
              versions: [],
              createdAt: '2026-10-18T12:00:00.000Z',
              updatedAt: '2026-10-18T12:00:00.000Z',
            },
          ],
        },
      });
    }
    if (pathname.endsWith(`/${kitListId}/active-version/structure`)) {
      return json(route, {
        data: {
          priceList: {
            id: kitListId,
            code: 'KIT_IMPLEMENTADOR_COM_CODIGO_EXTENSO',
            name: 'Componentes para implementadores',
            type: 'KIT_COMPONENT',
          },
          version: { version: 12 },
          items: [
            {
              sourceRow: 8,
              code: 'COMPONENTE-0000000001',
              description: longDescription,
              reference: null,
              minimumPrice: '12345.67',
              normalPrice: '23456.78',
              unitPrice: null,
              pisRate: '1.65',
              cofinsRate: '7.6',
              icmsRate: '12',
              ipiRate: '3.25',
            },
          ],
        },
        pagination: { page: 1, pageSize: 50, total: 100, totalPages: 2 },
      });
    }
    if (pathname.endsWith('/count')) return json(route, { data: { pending: 0 } });
    if (pathname.includes('/order-price-approvals')) {
      return json(route, { data: [], pagination: pagination(0, 0) });
    }
    return json(route, { data: {} });
  });
}

test.beforeEach(async ({ page }) => mockApplication(page));

test('Busca preserva dados, ordenação e paginação em layout intencional', async ({
  page,
}, testInfo) => {
  await page.goto('/calculos');
  const row = page.locator('.search-result-row');
  await expect(row).toContainText('KIT-CODIGO-MUITO-LONGO-001');
  await expect(row).toContainText('R$ 123.456.789,12');
  await assertNoDocumentHorizontalOverflow(page);

  if ((page.viewportSize()?.width ?? 0) <= 700) {
    await expect(row).toHaveCSS('display', 'grid');
    await expect(page.locator('#busca-sort')).toBeVisible();
    await page.locator('#busca-sort').selectOption('code');
    await expect(page).toHaveURL(/ordem=code/);
    await assertMinimumInteractiveArea(page.locator('#busca-sort-direction'));
  } else {
    await expect(page.locator('#busca-sort')).toBeHidden();
    await expect(row).toHaveCSS('display', 'table-row');
  }

  await assertElementWithinViewport(row.getByRole('button', { name: 'Ver' }));
  await row.getByRole('button', { name: /Ampliar foto/ }).click();
  const viewer = page.locator('#media-image-viewer');
  await expect(viewer).toHaveClass(/open/);
  await assertElementWithinViewport(viewer.locator('.modal-close'));
  await assertNoDocumentHorizontalOverflow(page);
  await viewer.locator('.modal-close').click();
  await captureResponsiveScreenshot(page, testInfo, { route: '/calculos', state: 'dados-longos' });
});

test('Produtos oferece cartões e composição rolável sem overflow global', async ({
  page,
}, testInfo) => {
  await page.goto('/produtos');
  const row = page.locator('.products-row');
  await expect(row).toContainText(longDescription);
  await assertNoDocumentHorizontalOverflow(page);

  if ((page.viewportSize()?.width ?? 0) <= 700) {
    await expect(row).toHaveCSS('display', 'grid');
    await assertMinimumInteractiveArea(row.getByRole('button', { name: 'Composição' }));
    await assertMinimumInteractiveArea(row.getByRole('button', { name: 'Adicionar foto' }));
  }

  await row.getByRole('button', { name: 'Composição' }).click();
  const modal = page.locator('#products-composition-modal');
  await expect(modal).toHaveClass(/open/);
  await expect(page.locator('#products-composition-body')).toContainText('COMPONENTE-0000000001');
  await assertElementWithinViewport(modal.locator('.modal-close'));
  await assertNoDocumentHorizontalOverflow(page);
  if ((page.viewportSize()?.width ?? 0) < 760) {
    const sizes = await page.locator('#products-composition-body').evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
  }
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/produtos',
    state: 'composicao-aberta',
  });
  await modal.locator('.modal-close').click();
  await row.getByRole('button', { name: 'Adicionar foto' }).click();
  const photoModal = page.locator('#products-photo-modal');
  await expect(photoModal).toHaveClass(/open/);
  await assertElementWithinViewport(photoModal.locator('.modal-close'));
  await assertElementWithinViewport(photoModal.getByRole('button', { name: 'Cancelar' }));
  await assertNoDocumentHorizontalOverflow(page);
});

test('Listas empilha cartões e contém formulário e estrutura', async ({ page }, testInfo) => {
  await page.goto('/listas');
  const card = page.locator(`[data-price-list="${kitListId}"]`);
  await expect(card).toContainText('Implementador nacional com classificação extensa');
  await assertNoDocumentHorizontalOverflow(page);

  await page.getByRole('button', { name: '+ Nova lista' }).click();
  const formModal = page.locator('#price-list-form-modal');
  await expect(formModal).toHaveClass(/open/);
  await assertElementWithinViewport(formModal.getByRole('button', { name: 'Criar lista' }));
  await assertNoDocumentHorizontalOverflow(page);
  await formModal.getByRole('button', { name: 'Cancelar' }).click();

  await card.getByRole('button', { name: 'Ver estrutura carregada' }).click();
  const structureModal = page.locator('#price-list-structure-modal');
  const structureRegion = page.locator('#price-list-structure-content');
  await expect(structureRegion).toContainText('COMPONENTE-0000000001');
  await expect(page.locator('#price-list-structure-page')).toHaveText('Página 1 de 2');
  await assertElementWithinViewport(structureModal.locator('.modal-close'));
  await assertElementWithinViewport(page.locator('#price-list-structure-next'));
  await assertNoDocumentHorizontalOverflow(page);
  if ((page.viewportSize()?.width ?? 0) < 820) {
    const sizes = await structureRegion.evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
  }
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/listas',
    state: 'estrutura-aberta',
  });
});
