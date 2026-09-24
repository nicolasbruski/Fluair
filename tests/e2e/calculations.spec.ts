import { expect, test, type Page } from '@playwright/test';
import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';

const priceListId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const customerId = '40000000-0000-4000-8000-000000000001';
const alternateCustomerId = '40000000-0000-4000-8000-000000000002';
const customerClass = {
  id: '60000000-0000-4000-8000-000000000001',
  code: 'IMPLEMENTER',
  name: 'Implementador',
  active: true,
};

async function mockSession(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Administradora',
            email: 'admin@fluair.test',
            permissions: [
              'calculation.create',
              'calculation.export',
              'matrix.view',
              'customer.view',
            ],
          },
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

test('simula com lista dinâmica e salva somente com cliente de classe compatível', async ({
  page,
}) => {
  await mockSession(page);
  const activeVersion = {
    id: versionId,
    version: 3,
    fileName: 'implementador-v3.xlsx',
    fileSize: 24576,
    fileHash: 'a'.repeat(64),
    itemCount: 2,
    importedBy: 'Administradora',
    createdAt: '2026-08-23T15:00:00.000Z',
  };
  await page.route('**/api/v1/price-lists', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          priceLists: [
            {
              id: priceListId,
              code: 'CUSTOM_DYNAMIC_LIST',
              name: 'Lista dinâmica para implementadores',
              type: 'KIT_COMPONENT',
              active: true,
              minimumOrderQuantity: null,
              maximumOrderQuantity: null,
              customerClasses: [customerClass],
              customerSegments: [],
              activeVersion,
              versions: [activeVersion],
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z',
            },
          ],
        },
      }),
    }),
  );
  await page.route('**/api/v1/calculations/preview/' + priceListId, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          preview: {
            kitCode: '130001',
            kitDescription: 'KIT CONDENSADOR TESTE',
            priceList: {
              id: priceListId,
              code: 'CUSTOM_DYNAMIC_LIST',
              name: 'Lista dinâmica para implementadores',
              customerClasses: [customerClass],
            },
            priceListVersion: activeVersion,
            sourceFileHash: 'b'.repeat(64),
            sourceFileName: 'folha-korp.xlsx',
            minimumTotal: 1250.5,
            normalTotal: 1499.9,
            itemCount: 2,
            missingPriceCount: 1,
            items: [
              {
                lineNumber: 1,
                code: '12345',
                description: 'COMPONENTE COM PREÇO',
                quantity: 2,
                unit: 'UN',
                minimumUnitPrice: 625.25,
                normalUnitPrice: 749.95,
                minimumTotal: 1250.5,
                normalTotal: 1499.9,
                hasPrice: true,
              },
              {
                lineNumber: 2,
                code: '67890',
                description: 'COMPONENTE SEM PREÇO',
                quantity: 1,
                unit: 'UN',
                minimumUnitPrice: 0,
                normalUnitPrice: 0,
                minimumTotal: 0,
                normalTotal: 0,
                hasPrice: false,
              },
            ],
            existing: {
              id: '50000000-0000-4000-8000-000000000001',
              version: 2,
              priceListVersion: 3,
              priceListVersionId: versionId,
              sourceFileHash: 'b'.repeat(64),
              minimumTotal: 1250.5,
              normalTotal: 1499.9,
              createdAt: '2026-08-20T12:00:00.000Z',
              createdBy: 'Administradora',
              image: {
                id: '70000000-0000-4000-8000-000000000001',
                thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
                displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
                width: 320,
                height: 240,
                updatedAt: '2026-08-20T12:00:00.000Z',
              },
            },
            currentKitImage: {
              id: '70000000-0000-4000-8000-000000000001',
              thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
              displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
              width: 320,
              height: 240,
              updatedAt: '2026-08-20T12:00:00.000Z',
            },
            image: {
              id: '70000000-0000-4000-8000-000000000001',
              thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
              displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
              width: 320,
              height: 240,
              updatedAt: '2026-08-20T12:00:00.000Z',
            },
          },
        },
      }),
    }),
  );
  await page.route('**/api/v1/customers**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [
            {
              id: customerId,
              code: 'C01619',
              legalName: 'Cliente Implementador Ltda',
              segment: 'IMPLEMENTADOR',
              customerClass,
              customerSegment: null,
              seller: 'Allan',
              representative: null,
              internalNote: null,
              orderNote: null,
              active: true,
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z',
            },
            {
              id: alternateCustomerId,
              code: 'C02020',
              legalName: 'Cliente Alternativo Ltda',
              segment: 'IMPLEMENTADOR',
              customerClass: null,
              customerSegment: null,
              seller: 'Beatriz',
              representative: null,
              internalNote: null,
              orderNote: null,
              active: true,
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z',
            },
          ],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/calculations/save/' + priceListId + '**', async (route) => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    expect(body).toContain('name="spreadsheet"; filename="folha-korp.xlsx"');
    expect(body).toContain('name="recalculate"');
    expect(body).toContain('false');
    expect(body).toContain(customerId);
    expect(body).toContain(versionId);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculation: {
            id: '50000000-0000-4000-8000-000000000002',
            version: 3,
            priceListVersion: 3,
            priceListVersionId: versionId,
            sourceFileHash: 'b'.repeat(64),
            minimumTotal: 1250.5,
            normalTotal: 1499.9,
            createdAt: '2026-08-23T15:30:00.000Z',
            createdBy: 'Administradora',
            kitCode: '130001',
            kitDescription: 'KIT CONDENSADOR TESTE',
            priceListName: 'Lista dinâmica para implementadores',
            customerId,
            customerName: 'Cliente Implementador Ltda',
            customerClass,
            image: {
              id: '70000000-0000-4000-8000-000000000001',
              thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
              displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
              width: 320,
              height: 240,
              updatedAt: '2026-08-20T12:00:00.000Z',
            },
          },
          createdVersion: true,
          customerLinked: true,
        },
      }),
    });
  });

  await page.goto('/calculos/novo');
  await expect(page.locator('#calc-price-list-options')).toContainText(
    'Aguardando cliente compatível',
  );
  await page.locator('#calc-matrices-open').click();
  await expect(page.locator('#calc-matrices-modal')).toHaveClass(/open/);
  await expect(page.locator('#calc-matrix-cards')).toContainText('Lista dinâmica');
  await page.locator('#calc-matrices-close').click();
  await expect(page.locator('#calc-matrices-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#calc-run')).toBeDisabled();
  await page.locator('#calc-photo-input').setInputFiles({
    name: 'kit-original.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.locator('#calc-photo-preview img')).toHaveAttribute('src', /^blob:/);
  await page.locator('#calc-photo-input').setInputFiles({
    name: 'kit-trocado.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFFxxxxWEBPVP8 '),
  });
  await expect(page.locator('#calc-photo-status')).toContainText('Nova foto selecionada');
  await page.locator('#calc-photo-remove').click();
  await expect(page.locator('#calc-photo-preview img')).toHaveCount(0);
  await page.locator('#calc-customer-trigger').click();
  await expect(page.locator('#calc-customer-modal')).toHaveClass(/open/);
  await page.getByRole('option', { name: /Cliente Alternativo Ltda/ }).click();
  await expect(page.locator('#calc-customer-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#calc-selected-customer')).toContainText('Cliente Alternativo Ltda');
  await expect(page.locator('#calc-run')).toBeDisabled();
  await page.locator('#calc-customer-trigger').click();
  await page.getByRole('option', { name: /Cliente Implementador Ltda/ }).click();
  await expect(page.locator('#calc-selected-customer')).toContainText('Cliente Implementador Ltda');
  await expect(page.locator('#calc-price-list-options')).toContainText('Lista dinâmica');
  await expect(page.locator('#calc-active-matrix')).toContainText('Implementador');

  await page.locator('#calc-korp-input').setInputFiles({
    name: 'folha-korp.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('arquivo de teste'),
  });
  await page.locator('#calc-run').click();
  await expect(page.getByText('KIT CONDENSADOR TESTE')).toBeVisible();
  await expect(page.locator('.tCard.min .tVal')).toHaveText('R$ 1.250,50');
  await expect(page.locator('.kitCard')).toContainText('Lista dinâmica para implementadores');
  await expect(page.locator('.kitCard')).toContainText('Implementador');
  await expect(page.locator('#calc-main .calc-preview-banner')).toHaveClass(/calc-result-saved/);
  await expect(page.locator('#calc-main .calc-preview-banner')).toContainText(
    'Cálculo já salvo. A versão v2 corresponde a esta folha e lista de preços.',
  );
  await expect(page.locator('#calc-open-save')).toHaveText('Vincular cliente');

  await page.locator('#calc-photo-input').setInputFiles({
    name: 'kit-exportacao-local.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const previewDownloadPromise = page.waitForEvent('download');
  await page.locator('#calc-export').click();
  const previewDownload = await previewDownloadPromise;
  expect(previewDownload.suggestedFilename()).toBe(
    'Preco_130001_Lista-dinâmica-para-implementadores.xlsx',
  );
  const previewPath = await previewDownload.path();
  expect(previewPath).not.toBeNull();
  const previewArchive = await JSZip.loadAsync(await readFile(previewPath!));
  expect(previewArchive.file('xl/media/image1.png')).not.toBeNull();
  await page.locator('#calc-photo-remove').click();

  await page.locator('#calc-open-save').click();
  await expect(page.locator('#calc-save-modal')).toHaveClass(/open/);
  await expect(page.locator('#calc-existing-state')).toContainText('Já calculado: Sim');
  await expect(page.locator('#calc-recalculate')).not.toBeChecked();
  await expect(page.locator('#calc-save-confirm')).toBeInViewport();
  await page.locator('#calc-save-confirm').click();

  await expect(page.locator('#calc-save-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#calc-main .calc-preview-banner')).toContainText(
    'Versão v3 vinculada a Cliente Implementador Ltda (Implementador)',
  );
});

test('mantém o cálculo bloqueado quando não existe lista dinâmica utilizável', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/price-lists', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { priceLists: [] } }),
    }),
  );
  await page.goto('/calculos/novo');
  await expect(page.locator('#calc-active-matrix')).toContainText('Nenhuma lista');
  await expect(page.locator('#calc-run')).toBeDisabled();
});
