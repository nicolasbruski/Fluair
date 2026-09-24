import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';

const calculationId = '50000000-0000-4000-8000-000000000001';
const oldCalculationId = '50000000-0000-4000-8000-000000000002';
const currentImage = {
  id: '70000000-0000-4000-8000-000000000002',
  thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000002/thumb',
  displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000002/display',
  width: 1200,
  height: 900,
  updatedAt: '2026-09-15T17:30:00.000Z',
};
const historicalImage = {
  ...currentImage,
  id: '70000000-0000-4000-8000-000000000001',
  thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
  displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
  updatedAt: '2026-08-01T11:30:00.000Z',
};
let mediaRequests: string[] = [];
const detail = {
  id: calculationId,
  version: 2,
  current: true,
  kitCode: '00130001',
  kitDescription: 'KIT CONDENSADOR REAL Usuario:\nSAMARA',
  priceList: {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'IMPLEMENTER',
    name: 'Implementador',
  },
  priceListVersion: { id: '30000000-0000-4000-8000-000000000001', version: 7 },
  sourceFileName: 'folha-real.xlsx',
  sourceFileHash: 'a'.repeat(64),
  minimumTotal: '4287.5000',
  normalTotal: '5130.0000',
  itemCount: 1,
  missingPriceCount: 0,
  origin: 'MANUAL_RECALCULATION',
  createdAt: '2026-09-15T17:32:00.000Z',
  createdBy: 'Samara',
  image: currentImage,
  customers: [
    {
      id: '10000000-0000-4000-8000-000000000001',
      code: 'C01619',
      legalName: 'Expresso Figueiredo',
      className: 'Implementador',
      linkedAt: '2026-09-15T17:35:00.000Z',
      linkedBy: 'Samara',
    },
  ],
  items: [
    {
      lineNumber: 1,
      code: '000704001',
      description: 'PARAFUSO REAL Usuário: SAMARA',
      quantity: '2.5000',
      unit: 'UN',
      minimumUnitPrice: '1715.0000',
      normalUnitPrice: '2052.0000',
      minimumTotal: '4287.5000',
      normalTotal: '5130.0000',
      hasPrice: true,
    },
  ],
};

test.beforeEach(async ({ page }) => {
  mediaRequests = [];
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/media/**', (route) => {
    mediaRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });
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
            permissions: [
              'calculation.view',
              'calculation.history',
              'calculation.export',
              'order.access',
              'price.view',
            ],
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/saved-catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { calculatedProducts: [], kits: [] },
        pagination: {
          page: 1,
          pageSize: 12,
          calculatedProductTotal: 0,
          calculatedProductTotalPages: 1,
          kitTotal: 0,
          kitTotalPages: 1,
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { customer: null, products: [], kits: [] },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 0,
          productTotalPages: 1,
          kitTotal: 0,
          kitTotalPages: 1,
        },
      }),
    }),
  );
  await page.route('**/api/v1/customers?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/calculations/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/history'))
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            kit: { code: detail.kitCode, description: detail.kitDescription },
            priceList: detail.priceList,
            versions: [
              {
                id: calculationId,
                version: 2,
                current: true,
                priceListVersion: 7,
                sourceFileName: 'folha-real.xlsx',
                sourceFileHash: 'a'.repeat(64),
                minimumTotal: '4287.5000',
                normalTotal: '5130.0000',
                itemCount: 1,
                missingPriceCount: 0,
                origin: 'MANUAL_RECALCULATION',
                createdAt: detail.createdAt,
                createdBy: 'Samara',
                image: currentImage,
              },
              {
                id: oldCalculationId,
                version: 1,
                current: false,
                priceListVersion: 6,
                sourceFileName: 'folha-antiga.xlsx',
                sourceFileHash: 'b'.repeat(64),
                minimumTotal: '4000.0000',
                normalTotal: '4800.0000',
                itemCount: 1,
                missingPriceCount: 0,
                origin: 'FIRST_CALCULATION',
                createdAt: '2026-08-01T12:00:00.000Z',
                createdBy: 'Admin',
                image: historicalImage,
              },
            ],
          },
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculation: path.endsWith(oldCalculationId)
            ? {
                ...detail,
                id: oldCalculationId,
                version: 1,
                current: false,
                image: historicalImage,
              }
            : detail,
        },
      }),
    });
  });
});

test('abre composição real, histórico, exporta e encaminha o kit ao pedido', async ({ page }) => {
  await page.goto(`/calculos/${calculationId}?returnTo=%2Fcalculos%3Fq%3Dcondensador`);

  const screen = page.locator('#s-detalhe');
  await expect(screen).toBeVisible();
  await expect(screen.getByText('00130001', { exact: true })).toBeVisible();
  await expect(screen.getByText('KIT CONDENSADOR REAL', { exact: true })).toBeVisible();
  await expect(screen.getByText('PARAFUSO REAL', { exact: true })).toBeVisible();
  await expect(screen.getByText(/Usu[aá]rio:/i)).toHaveCount(0);
  await expect(screen.getByRole('columnheader', { name: 'Ope.' })).toHaveCount(0);
  await expect(screen.getByRole('columnheader', { name: 'Condição' })).toHaveCount(0);
  await expect(screen.getByText('C01619 · Expresso Figueiredo')).toBeVisible();
  await expect(screen.getByText('R$ 4.287,50').first()).toBeVisible();
  await expect(screen.getByText('R$ 5.130,00').first()).toBeVisible();
  await expect(screen.getByText('Foto do kit')).toBeVisible();
  const versionPhoto = screen.getByRole('button', { name: /Ampliar foto de Kit 00130001/ });
  await versionPhoto.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#media-image-viewer')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#media-image-viewer')).not.toHaveClass(/open/);
  await expect(versionPhoto).toBeFocused();
  await page.screenshot({ path: 'tmp/task-004-detail-desktop.png', fullPage: true });

  const downloadPromise = page.waitForEvent('download');
  await screen.getByRole('button', { name: 'Exportar Excel' }).click();
  const excelDownload = await downloadPromise;
  expect(excelDownload.suggestedFilename()).toBe('Calculo_00130001_v2.xlsx');
  const excelPath = await excelDownload.path();
  expect(excelPath).not.toBeNull();
  const excelBytes = await readFile(excelPath!);
  const workbook = XLSX.read(excelBytes, { type: 'buffer', cellDates: true });
  expect(workbook.Sheets['Cálculo']?.['C8']?.v).toBe(2.5);
  expect(workbook.Sheets['Cálculo']?.['F8']?.v).toBe(4287.5);
  const archive = await JSZip.loadAsync(excelBytes);
  expect(archive.file('xl/media/image1.png')).not.toBeNull();
  if (process.env.XLSX_QA_OUTPUT) await excelDownload.saveAs(process.env.XLSX_QA_OUTPUT);

  const pdfDownloadPromise = page.waitForEvent('download');
  await screen.getByRole('button', { name: 'Exportar PDF' }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toBe('Calculo_00130001_v2.pdf');
  if (process.env.PDF_QA_OUTPUT) await pdfDownload.saveAs(process.env.PDF_QA_OUTPUT);

  await page.unroute('**/api/v1/media/**');
  await page.route('**/api/v1/media/**', (route) => route.abort());
  const pdfWithoutImagePromise = page.waitForEvent('download');
  await screen.getByRole('button', { name: 'Exportar PDF' }).click();
  const pdfWithoutImage = await pdfWithoutImagePromise;
  expect(pdfWithoutImage.suggestedFilename()).toBe('Calculo_00130001_v2.pdf');
  if (process.env.PDF_QA_NO_IMAGE_OUTPUT)
    await pdfWithoutImage.saveAs(process.env.PDF_QA_NO_IMAGE_OUTPUT);

  await page.unroute('**/api/v1/media/**');
  await page.route('**/api/v1/media/**', (route) => {
    mediaRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    });
  });

  await screen.getByRole('button', { name: 'Histórico de versões' }).click();
  const history = page.locator('#modal-historico');
  await expect(history).toHaveClass(/open/);
  await expect(history.getByText('Versão 2')).toBeVisible();
  await expect(history.getByText('Versão 1')).toBeVisible();
  await expect(history.getByRole('button', { name: /Ampliar foto/ })).toHaveCount(2);
  await expect(
    history.locator('img[src*="70000000-0000-4000-8000-000000000001/thumb"]'),
  ).toBeVisible();
  await expect(history.getByRole('button', { name: 'Excel' })).toHaveCount(2);
  await expect(history.getByRole('button', { name: 'PDF', exact: true })).toHaveCount(2);
  const historicalDownloadPromise = page.waitForEvent('download');
  await history.getByRole('button', { name: 'Excel' }).nth(1).click();
  expect((await historicalDownloadPromise).suggestedFilename()).toBe('Calculo_00130001_v1.xlsx');
  expect(mediaRequests).toContain('/api/v1/media/70000000-0000-4000-8000-000000000001/display');
  await history.locator('#detail-history-done').click();

  await screen.getByRole('button', { name: 'Gerar pedido com este kit' }).click();
  await expect(page).toHaveURL(/\/pedidos\/novo/);
  expect(new URL(page.url()).searchParams.get('calculo')).toBe(calculationId);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
    `/calculos/${calculationId}?returnTo=%2Fcalculos%3Fq%3Dcondensador`,
  );
  await expect(page.locator('#s-pedido')).toBeVisible();
  await expect(page.locator('#pedidoItems')).toContainText('KIT CONDENSADOR REAL');
  await expect(page.locator('#order-prefill-feedback')).toHaveCount(0);
  const backButton = page.locator('#order-back');
  await expect(backButton).toBeVisible();
  const [backBox, orderBox] = await Promise.all([
    backButton.boundingBox(),
    page.locator('.orders-shell').boundingBox(),
  ]);
  expect(backBox).not.toBeNull();
  expect(orderBox).not.toBeNull();
  expect(backBox!.x + backBox!.width).toBeLessThan(orderBox!.x);
  await backButton.click();
  await expect(page).toHaveURL(`/calculos/${calculationId}?returnTo=%2Fcalculos%3Fq%3Dcondensador`);
  await expect(screen).toBeVisible();
  await expect(screen.getByText('KIT CONDENSADOR REAL', { exact: true })).toBeVisible();
});

test('oculta as exportações sem calculation.export', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Consulta',
            email: 'consulta@fluair.test',
            permissions: ['calculation.view', 'calculation.history'],
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );

  await page.goto(`/calculos/${calculationId}`);
  const screen = page.locator('#s-detalhe');
  await expect(screen.getByText('00130001', { exact: true })).toBeVisible();
  await expect(screen.getByRole('button', { name: 'Exportar Excel' })).toHaveCount(0);
  await expect(screen.getByRole('button', { name: 'Exportar PDF' })).toHaveCount(0);
  await screen.getByRole('button', { name: 'Histórico de versões' }).click();
  await expect(page.locator('#modal-historico').getByRole('button', { name: 'Excel' })).toHaveCount(
    0,
  );
});
