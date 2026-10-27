import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const calculationId = '50000000-0000-4000-8000-000000000001';
const priceListId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const customerId = '40000000-0000-4000-8000-000000000001';
const image = {
  id: '70000000-0000-4000-8000-000000000001',
  thumbnailUrl: `/api/v1/media/70000000-0000-4000-8000-000000000001/thumb`,
  displayUrl: `/api/v1/media/70000000-0000-4000-8000-000000000001/display`,
  width: 1200,
  height: 900,
  updatedAt: '2026-10-18T12:00:00.000Z',
};
const longText =
  'Descrição industrial excepcionalmente longa para validar quebra segura sem ampliar o documento';
const customerClass = {
  id: '60000000-0000-4000-8000-000000000001',
  code: 'IMPLEMENTER',
  name: 'Implementador com classificação comercial extensa',
  active: true,
};
const activeVersion = {
  id: versionId,
  version: 12,
  fileName: 'estrutura-com-nome-muito-longo.xlsx',
  fileSize: 2048,
  fileHash: 'a'.repeat(64),
  itemCount: 2,
  importedBy: 'Administradora responsiva',
  createdAt: '2026-10-18T12:00:00.000Z',
};
const items = [
  {
    lineNumber: 1,
    code: 'COMPONENTE-CODIGO-MUITO-LONGO-0001',
    description: longText,
    quantity: '99999.5000',
    unit: 'UN',
    minimumUnitPrice: '1234567.8900',
    normalUnitPrice: '2345678.9000',
    minimumTotal: '123456789.1200',
    normalTotal: '223456789.3400',
    hasPrice: true,
  },
  {
    lineNumber: 2,
    code: 'SEM-PRECO-0002',
    description: `Sem preço · ${longText}`,
    quantity: '1.0000',
    unit: 'PC',
    minimumUnitPrice: '0',
    normalUnitPrice: '0',
    minimumTotal: '0',
    normalTotal: '0',
    hasPrice: false,
  },
];

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockApplication(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/v1/auth/me') {
      return json(route, {
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Administradora responsiva',
            email: 'admin@fluair.test',
            permissions: [
              'calculation.view',
              'calculation.create',
              'calculation.history',
              'calculation.export',
              'customer.view',
              'matrix.view',
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
    if (pathname === '/api/v1/price-lists') {
      return json(route, {
        data: {
          priceLists: [
            {
              id: priceListId,
              code: 'KIT_COMPONENTES_RESPONSIVO',
              name: 'Lista de componentes para implementadores nacionais',
              type: 'KIT_COMPONENT',
              active: true,
              minimumOrderQuantity: null,
              maximumOrderQuantity: null,
              customerClasses: [customerClass],
              customerSegments: [],
              activeVersion,
              versions: [activeVersion],
              createdAt: activeVersion.createdAt,
              updatedAt: activeVersion.createdAt,
            },
          ],
        },
      });
    }
    if (pathname === '/api/v1/customers') {
      return json(route, {
        data: {
          customers: [
            {
              id: customerId,
              code: 'CLIENTE-CODIGO-EXTENSO-0001',
              legalName: 'Cliente Industrial com Razão Social Excepcionalmente Longa Ltda.',
              segment: 'Industrial de grande porte e operação nacional',
              customerClass,
              customerSegment: null,
              seller: 'Vendedora com nome operacional muito longo',
              representative: 'Representante comercial com nome muito longo',
              internalNote: null,
              orderNote: null,
              active: true,
              createdAt: activeVersion.createdAt,
              updatedAt: activeVersion.createdAt,
            },
          ],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      });
    }
    if (pathname === `/api/v1/calculations/preview/${priceListId}`) {
      return json(route, {
        data: {
          preview: {
            kitCode: 'KIT-CODIGO-MUITO-LONGO-0001',
            kitDescription: longText,
            kitReference: 'REFERENCIA-SEM-ESPACOS-0000000000001',
            warnings: [],
            priceList: {
              id: priceListId,
              code: 'KIT_COMPONENTES_RESPONSIVO',
              name: 'Lista de componentes para implementadores nacionais',
              customerClasses: [customerClass],
            },
            priceListVersion: activeVersion,
            sourceFileHash: 'b'.repeat(64),
            sourceFileName: 'folha-responsiva.xlsx',
            minimumTotal: 123456789.12,
            normalTotal: 223456789.34,
            itemCount: 2,
            missingPriceCount: 1,
            items: items.map((item) => ({ ...item, quantity: Number(item.quantity) })),
            existing: null,
            currentKitImage: image,
            image,
          },
        },
      });
    }
    if (pathname === `/api/v1/calculations/${calculationId}/history`) {
      return json(route, {
        data: {
          kit: { code: 'KIT-CODIGO-MUITO-LONGO-0001', description: longText },
          priceList: { id: priceListId, code: 'RESP', name: 'Lista responsiva extensa' },
          versions: [1, 2, 3, 4].map((version) => ({
            id: calculationId,
            version,
            current: version === 4,
            priceListVersion: version + 8,
            sourceFileName: `folha-versao-${version}.xlsx`,
            sourceFileHash: String(version).repeat(64),
            minimumTotal: '123456789.1200',
            normalTotal: '223456789.3400',
            itemCount: 2,
            missingPriceCount: 1,
            origin: version === 1 ? 'FIRST_CALCULATION' : 'MANUAL_RECALCULATION',
            createdAt: `2026-0${version + 5}-18T12:00:00.000Z`,
            createdBy: 'Responsável com nome operacional muito longo',
            image: version % 2 ? null : image,
            lastOrderPrice: null,
          })),
        },
      });
    }
    if (pathname === `/api/v1/calculations/${calculationId}`) {
      return json(route, {
        data: {
          calculation: {
            id: calculationId,
            version: 4,
            current: true,
            kitCode: 'KIT-CODIGO-MUITO-LONGO-0001',
            kitDescription: longText,
            priceList: { id: priceListId, code: 'RESP', name: 'Lista responsiva extensa' },
            priceListVersion: { id: versionId, version: 12 },
            sourceFileName: 'folha-responsiva.xlsx',
            sourceFileHash: 'b'.repeat(64),
            minimumTotal: '123456789.1200',
            normalTotal: '223456789.3400',
            itemCount: 2,
            missingPriceCount: 1,
            origin: 'MANUAL_RECALCULATION',
            createdAt: activeVersion.createdAt,
            createdBy: 'Responsável com nome operacional muito longo',
            image,
            customers: [
              {
                id: customerId,
                code: 'CLIENTE-CODIGO-EXTENSO-0001',
                legalName: 'Cliente Industrial com Razão Social Excepcionalmente Longa Ltda.',
                className: customerClass.name,
                linkedAt: activeVersion.createdAt,
                linkedBy: 'Administradora responsiva',
              },
            ],
            items,
          },
        },
      });
    }
    if (pathname.endsWith('/count')) return json(route, { data: { pending: 0 } });
    if (pathname.includes('/order-price-approvals'))
      return json(route, { data: { approvals: [] } });
    return json(route, { data: {} });
  });
}

test.beforeEach(async ({ page }) => mockApplication(page));

test('Cálculo empilha configuração, preserva clientes e contém a composição', async ({
  page,
}, testInfo) => {
  await page.goto('/calculos/novo');
  await page.locator('#calc-customer-trigger').click();
  const customerModal = page.locator('#calc-customer-modal');
  await expect(customerModal).toHaveClass(/open/);
  const option = customerModal.getByRole('option');
  await expect(option).toContainText('CLIENTE-CODIGO-EXTENSO-0001');
  await expect(option).toContainText(customerClass.name);
  await expect(option).toContainText('Representante comercial com nome muito longo');
  await assertElementWithinViewport(customerModal.locator('#calc-customer-close'));
  await assertElementWithinViewport(customerModal.locator('#calc-customer-cancel'));
  await assertNoDocumentHorizontalOverflow(page);
  await option.click();

  await page.locator('#calc-korp-input').setInputFiles({
    name: 'folha-responsiva.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('arquivo de teste'),
  });
  await page.locator('#calc-run').click();
  await expect(page.locator('.kitCard')).toContainText(longText);
  await expect(page.locator('.tCard.min')).toContainText('R$ 123.456.789,12');
  await expect(page.locator('.calc-table-wrap')).toContainText('COMPONENTE-CODIGO-MUITO-LONGO');
  await assertNoDocumentHorizontalOverflow(page);
  await assertMinimumInteractiveArea(page.locator('#calc-open-save'));

  if ((page.viewportSize()?.width ?? 0) <= 760) {
    const [sidebar, main] = await Promise.all([
      page.locator('.calc-sidebar').boundingBox(),
      page.locator('#calc-main').boundingBox(),
    ]);
    expect(sidebar).not.toBeNull();
    expect(main).not.toBeNull();
    expect(sidebar!.y).toBeLessThan(main!.y);
  }

  if ((page.viewportSize()?.width ?? 0) < 760) {
    const sizes = await page.locator('.calc-table-wrap').evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
  }

  await page.locator('#calc-open-save').click();
  const saveModal = page.locator('#calc-save-modal');
  await expect(saveModal).toHaveClass(/open/);
  await assertElementWithinViewport(saveModal.locator('#calc-save-close'));
  await assertElementWithinViewport(saveModal.locator('#calc-save-confirm'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/calculos/novo',
    state: 'salvamento-aberto',
  });
});

test('Detalhe reorganiza mídia e mantém histórico rolável e operável', async ({
  page,
}, testInfo) => {
  await page.goto(`/calculos/${calculationId}`);
  await expect(page.locator('#detalhe-main')).toContainText(longText);
  await expect(page.locator('.tCard.min')).toContainText('R$ 123.456.789,12');
  await expect(page.locator('.detail-composition-region')).toContainText(
    'COMPONENTE-CODIGO-MUITO-LONGO',
  );
  const detailCells = page.locator('.detail-composition-table tbody tr').first().locator('td');
  const [detailCodeBox, detailUnitBox] = await Promise.all([
    detailCells.nth(0).boundingBox(),
    detailCells.nth(3).boundingBox(),
  ]);
  expect(detailCodeBox?.width).toBeGreaterThanOrEqual(180);
  expect(detailUnitBox?.width).toBeGreaterThanOrEqual(72);
  await assertNoDocumentHorizontalOverflow(page);
  await assertElementWithinViewport(page.locator('#detail-back'));
  await assertMinimumInteractiveArea(page.locator('#detail-history'));

  const mobileNavigation = (page.viewportSize()?.width ?? 0) <= 1024;
  if (mobileNavigation) await page.locator('#nav-menu-toggle').click();
  await page.locator('#hide-reference-prices').check({ force: true });
  await expect(page.locator('body')).toHaveClass(/reference-prices-hidden/);
  await assertNoDocumentHorizontalOverflow(page);
  await page.locator('#hide-reference-prices').uncheck({ force: true });
  if (mobileNavigation) await page.keyboard.press('Escape');

  if ((page.viewportSize()?.width ?? 0) < 760) {
    const sizes = await page.locator('.detail-composition-region').evaluate((element) => ({
      client: element.clientWidth,
      scroll: element.scrollWidth,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
  }

  await page.locator('#detail-history').click();
  const history = page.locator('#modal-historico');
  await expect(history).toHaveClass(/open/);
  await expect(history.locator('.detail-history-entry')).toHaveCount(4);
  await expect(history).toContainText('Responsável com nome operacional muito longo');
  await expect(history.getByText('Sem foto', { exact: true })).toHaveCount(4);
  await assertElementWithinViewport(history.locator('#detail-history-close'));
  await assertElementWithinViewport(history.locator('#detail-history-done'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: `/calculos/${calculationId}`,
    state: 'historico-aberto',
  });
});

test('Cálculo e salvamento permanecem utilizáveis com reflow equivalente a 200%', async ({
  page,
}) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 1280, 'Executado no projeto notebook.');
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/calculos/novo');
  await page.locator('#calc-customer-trigger').click();
  await assertElementWithinViewport(page.locator('#calc-customer-close'));
  await page.locator('#calc-customer-modal').getByRole('option').click();
  await page.locator('#calc-korp-input').setInputFiles({
    name: 'folha-responsiva.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('arquivo de teste'),
  });
  await page.locator('#calc-run').click();
  await page.locator('#calc-open-save').click();
  await assertElementWithinViewport(page.locator('#calc-save-confirm'));
  await assertNoDocumentHorizontalOverflow(page);
});
