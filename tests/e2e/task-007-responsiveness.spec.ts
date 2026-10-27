import { readFile } from 'node:fs/promises';

import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const customer = {
  id: '10000000-0000-4000-8000-000000000001',
  code: 'CLIENTE-CODIGO-EXTENSO-0001',
  legalName: 'Cliente Industrial com Razão Social Excepcionalmente Longa para Teste Responsivo Ltda.',
  cnpj: '12345678000190',
  city: 'São José dos Campos com complemento extenso',
  state: 'SP',
  segment: 'INDUSTRIA',
  customerClass: {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'IMPLEMENTER',
    name: 'Implementador com classificação extensa',
    active: true,
  },
  customerSegment: {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'INDUSTRY',
    name: 'Indústria de equipamentos de grande porte',
    active: true,
  },
  seller: 'Vendedora com nome operacional excepcionalmente longo',
  representative: 'Representante comercial regional com nome extenso',
  internalNote: 'Observação interna longa que deve quebrar sem aumentar a largura do documento.',
  orderNote: 'Confirmar o recebimento e a janela de entrega antes de emitir o pedido.',
  active: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora de Clientes',
  email: 'admin.clientes@fluair.test',
  roleCode: 'ADMINISTRATOR',
  permissions: ['customer.view', 'customer.manage', 'order.access', 'price.view'],
};

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

test('Clientes mantém cartões, filtros, ações, formulário e detalhe dentro da viewport', async ({
  page,
}, testInfo) => {
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/auth/me') {
      return json(route, {
        data: { user: admin, session: { expiresAt: '2027-01-01T00:00:00.000Z' } },
      });
    }
    if (url.pathname === '/api/v1/customers/classifications') {
      return json(route, {
        data: {
          customerClasses: [customer.customerClass],
          customerSegments: [customer.customerSegment],
        },
      });
    }
    if (url.pathname === '/api/v1/customers') {
      return json(route, {
        data: {
          customers: [customer],
          filters: {
            segments: [customer.segment],
            sellers: [customer.seller],
            representatives: [customer.representative],
          },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      });
    }
    if (url.pathname.endsWith('/calculation-links')) {
      return json(route, {
        data: {
          customer: { id: customer.id, code: customer.code, legalName: customer.legalName },
          calculations: [
            {
              calculationId: '50000000-0000-4000-8000-000000000001',
              version: 12,
              current: true,
              kitCode: 'KIT-CODIGO-MUITO-LONGO-0001',
              kitDescription: 'Kit industrial com descrição longa para validar a tabela interna',
              priceListName: 'Lista comercial nacional com nome extenso',
              className: customer.customerClass.name,
              linkedAt: '2026-10-18T12:00:00.000Z',
              linkedBy: 'Usuária responsável com nome extenso',
              lastOrderPrice: null,
              items: Array.from({ length: 12 }, (_, index) => ({
                id: `60000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
                code: `ITEM-CODIGO-EXTENSO-${index + 1}`,
                description: `Componente industrial com descrição extensa número ${index + 1}`,
                quantity: '9999.0000',
                unit: 'UN',
                minimumUnitPrice: '123456.7800',
                normalUnitPrice: '234567.8900',
              })),
            },
          ],
        },
      });
    }
    if (url.pathname.endsWith('/count')) return json(route, { data: { pending: 0 } });
    if (url.pathname.includes('/order-price-approvals/')) {
      return json(route, {
        data: [],
        pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
      });
    }
    return json(route, { error: { code: 'UNMOCKED_API', message: url.pathname } }, 501);
  });

  await page.goto('/clientes');
  const screen = page.locator('#s-clientes');
  await expect(screen.locator('.customer-row')).toHaveCount(1);
  await expect(screen.locator('.customer-row')).toContainText(customer.representative);
  await assertNoDocumentHorizontalOverflow(page);

  const actions = screen.locator('.customer-actions-buttons .btn');
  for (let index = 0; index < (await actions.count()); index += 1) {
    await assertMinimumInteractiveArea(actions.nth(index));
    await assertElementWithinViewport(actions.nth(index));
  }

  await screen.getByRole('button', { name: 'Visualizar' }).click();
  const detail = page.locator('#customer-links-modal .customer-links-modal');
  await assertElementWithinViewport(detail);
  await page.getByRole('tab', { name: 'Kits vinculados' }).click();
  await page.locator('.customer-calculation-card summary').click();
  await expect(page.locator('.customer-calculation-items tbody tr')).toHaveCount(12);
  await expect(page.locator('.customer-calculation-content')).toHaveAttribute('tabindex', '0');
  await assertNoDocumentHorizontalOverflow(page);
  await page.locator('#customer-links-done').click();

  await screen.locator('#customers-add').click();
  await assertElementWithinViewport(page.locator('#customer-form-modal .customer-modal'));
  await assertElementWithinViewport(page.locator('#customer-form-submit'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/clientes',
    state: 'formulario-carregado',
  });
});

test('Comissões mantém relatório rolável, filtros, clientes e modais legíveis', async ({
  page,
}, testInfo) => {
  const source = await readFile('Comissoes/sistema_comissao_v3.html', 'utf8');
  await page.route('**/comissoes', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: source }),
  );
  await page.route('**/comissoes/imagem/Logo.jpg', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/commissions/customers', (route) =>
    json(route, {
      data: {
        customers: [
          {
            ...customer,
            customerClass: null,
            customerSegment: null,
            segment: 'INDUSTRIA',
          },
        ],
      },
    }),
  );

  await page.goto('/comissoes');
  await page.evaluate(() => {
    window.eval(`
      allRows = [{
        cod: 'CLIENTE-CODIGO-EXTENSO-0001',
        cliente: 'Cliente Industrial com Razão Social Excepcionalmente Longa Ltda.',
        nfe: 'NF-E-12345678901234567890',
        vencimento: '31/12/2026',
        pedido: 'PEDIDO-EXTENSO-000001',
        ord_comp: 'ORDEM-DE-COMPRA-EXTENSA-0001',
        valor_nf: 123456789.12,
        pct: 12.5,
        base: 98765432.1,
        valor_com: 12345678.9,
        segmento: 'INDUSTRIA',
        vendedor: 'Vendedora com nome operacional muito longo',
        representante: 'Representante comercial com nome muito longo'
      }];
      filtered = [...allRows];
      buildFilterOptions();
      renderStats();
      buildHead();
      renderTable();
      document.getElementById('resultSection').style.display = 'block';
    `);
  });

  await expect(page.locator('#statsGrid .stat')).toHaveCount(5);
  await expect(page.locator('#mainBody tr')).toHaveCount(1);
  await expect(page.locator('#mainTable')).toContainText(customer.representative);
  await expect
    .poll(() =>
      page.locator('#mainTable td, #mainTable th').evaluateAll((cells) =>
        cells.every((cell) => Number.parseFloat(getComputedStyle(cell).fontSize) >= 11),
      ),
    )
    .toBe(true);
  await assertNoDocumentHorizontalOverflow(page);

  const tableRegion = page.getByRole('region', { name: 'Relatório de comissões' });
  await expect(tableRegion).toHaveAttribute('tabindex', '0');
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await expect
      .poll(() => tableRegion.evaluate((element) => element.scrollWidth > element.clientWidth))
      .toBe(true);
  }

  await page.getByRole('button', { name: 'Filtros' }).click();
  await assertElementWithinViewport(page.locator('#filterDD'));
  await page.locator('#filterDD .btn-sky').click();
  await page.getByRole('button', { name: 'Prévia' }).click();
  await assertElementWithinViewport(page.locator('#previewModal .preview-modal'));
  await page.locator('#previewModal .btn-ghost').click();

  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.locator('#cliBody tr')).toHaveCount(1);
  await expect(page.locator('#cliBody')).toContainText(customer.seller);
  await expect(page.locator('#cliBody td').first()).toHaveAttribute('data-label', 'Código');
  await assertNoDocumentHorizontalOverflow(page);
  await page.getByRole('button', { name: '+ Adicionar cliente' }).click();
  await assertElementWithinViewport(page.locator('#clientFormModal .customer-form-modal'));
  await assertElementWithinViewport(page.locator('#addClientButton'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/comissoes',
    state: 'clientes-formulario',
  });
});
