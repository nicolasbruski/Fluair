import { readFile } from 'node:fs/promises';

import { expect, test, type Page, type Route } from '@playwright/test';

import type { Customer } from '../../src/shared/customers.js';

const sessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora do Banco',
  email: 'admin@fluair.test',
  roleCode: 'ADMINISTRATOR',
  permissions: ['customer.view', 'customer.manage', 'order.access', 'price.view'],
};

const customerClasses = {
  implementer: {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'IMPLEMENTER',
    name: 'Implementador',
    active: true,
  },
  reseller: {
    id: '30000000-0000-4000-8000-000000000002',
    code: 'RESELLER',
    name: 'Revenda',
    active: true,
  },
  endConsumer: {
    id: '30000000-0000-4000-8000-000000000003',
    code: 'END_CONSUMER',
    name: 'Consumidor Final',
    active: true,
  },
};

const customerSegments = {
  fleetOwner: {
    id: '40000000-0000-4000-8000-000000000001',
    code: 'FLEET_OWNER',
    name: 'Frotista',
    active: true,
  },
  serviceStation: {
    id: '40000000-0000-4000-8000-000000000002',
    code: 'SERVICE_STATION',
    name: 'Posto de Serviço',
    active: true,
  },
  autoParts: {
    id: '40000000-0000-4000-8000-000000000003',
    code: 'AUTO_PARTS',
    name: 'Autopeças',
    active: true,
  },
};

const initialCustomers: Customer[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    code: 'C01619',
    legalName: 'Expresso Figueiredo',
    cnpj: '12345678000190',
    city: 'São Paulo',
    state: 'SP',
    segment: 'FROTISTA',
    customerClass: customerClasses.implementer,
    customerSegment: customerSegments.fleetOwner,
    seller: 'Marcelo Ort',
    representative: null,
    internalNote: 'Contato prefere atendimento por telefone.',
    orderNote: 'Entregar somente no período da manhã.',
    active: true,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    code: 'C00722',
    legalName: 'Lider Sul Ltda',
    cnpj: null,
    city: 'Curitiba',
    state: 'PR',
    segment: 'POSTO DE SERVICO',
    customerClass: customerClasses.reseller,
    customerSegment: customerSegments.serviceStation,
    seller: 'Marcelo Ort',
    representative: 'Progresso',
    internalNote: null,
    orderNote: null,
    active: true,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    code: 'C01842',
    legalName: 'M C Freimuth Ltda',
    cnpj: null,
    city: null,
    state: null,
    segment: 'AUTO-PECAS',
    customerClass: null,
    customerSegment: customerSegments.autoParts,
    seller: 'Fernando',
    representative: 'Five',
    internalNote: null,
    orderNote: null,
    active: true,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

async function mockSession(page: Page, user = sessionUser): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user,
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
}

test('consulta, filtra, cria, edita e desativa clientes retornados pela API', async ({ page }) => {
  let customers = structuredClone(initialCustomers);
  let exportedClassId: string | null = null;
  await mockSession(page);
  await page.route('**/api/v1/customers**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (pathname === '/api/v1/customers/classifications' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            customerClasses: Object.values(customerClasses),
            customerSegments: Object.values(customerSegments),
          },
        }),
      });
      return;
    }
    if (pathname === '/api/v1/customers/export' && request.method() === 'GET') {
      exportedClassId = url.searchParams.get('customerClassId');
      const exported = customers.filter(
        (customer) => !exportedClassId || customer.customerClass?.id === exportedClassId,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customers: exported } }),
      });
      return;
    }
    if (
      pathname === `/api/v1/customers/${initialCustomers[0]!.id}/calculation-links` &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            customer: {
              id: initialCustomers[0]!.id,
              code: initialCustomers[0]!.code,
              legalName: initialCustomers[0]!.legalName,
            },
            calculations: [
              {
                calculationId: '50000000-0000-4000-8000-000000000001',
                version: 2,
                current: true,
                kitCode: '131507',
                kitDescription: 'KIT DE FREIO',
                priceListName: 'Consumidor Final',
                className: 'Implementador',
                linkedAt: '2026-09-15T12:00:00.000Z',
                linkedBy: 'Samara',
                items: [
                  {
                    id: '60000000-0000-4000-8000-000000000001',
                    code: '300025',
                    description: 'FILTRO DE REDE M16',
                    quantity: '1',
                    unit: 'UN',
                    minimumUnitPrice: '2.1500',
                    normalUnitPrice: '3.2000',
                  },
                  ...Array.from({ length: 15 }, (_, index) => ({
                    id: `60000000-0000-4000-8000-${String(index + 2).padStart(12, '0')}`,
                    code: `300${String(index + 26).padStart(3, '0')}`,
                    description: `ITEM ADICIONAL DO KIT ${index + 1}`,
                    quantity: '1',
                    unit: 'UN',
                    minimumUnitPrice: '1.0000',
                    normalUnitPrice: '2.0000',
                  })),
                ],
              },
            ],
          },
        }),
      });
      return;
    }
    if (pathname === `/api/v1/customers/${initialCustomers[0]!.id}` && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer: initialCustomers[0] } }),
      });
      return;
    }
    if (pathname === '/api/v1/customers' && request.method() === 'GET') {
      const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('pt-BR');
      const status = url.searchParams.get('status') ?? 'active';
      const customerClassId = url.searchParams.get('customerClassId');
      const customerSegmentId = url.searchParams.get('customerSegmentId');
      const filtered = customers.filter((customer) => {
        if (status !== 'all' && customer.active !== (status === 'active')) return false;
        if (customerClassId && customer.customerClass?.id !== customerClassId) return false;
        if (customerSegmentId && customer.customerSegment?.id !== customerSegmentId) return false;
        return `${customer.code} ${customer.legalName}`.toLocaleLowerCase('pt-BR').includes(search);
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            customers: filtered,
            filters: {
              segments: ['AUTO-PECAS', 'FROTISTA', 'POSTO DE SERVICO'],
              sellers: ['Fernando', 'Marcelo Ort'],
              representatives: ['Five', 'Progresso'],
            },
            pagination: { page: 1, pageSize: 25, total: filtered.length, totalPages: 1 },
          },
        }),
      });
      return;
    }
    if (pathname === '/api/v1/customers' && request.method() === 'POST') {
      const input = request.postDataJSON() as Record<string, string | null>;
      const customer = {
        id: '10000000-0000-4000-8000-000000000004',
        code: input.code?.toUpperCase() ?? '',
        legalName: input.legalName ?? '',
        cnpj: input.cnpj?.replace(/\D/g, '') || null,
        city: input.city || null,
        state: input.state?.toUpperCase() || null,
        segment: input.segment || null,
        customerClass:
          Object.values(customerClasses).find((item) => item.id === input.customerClassId) ?? null,
        customerSegment:
          Object.values(customerSegments).find((item) => item.id === input.customerSegmentId) ??
          null,
        seller: input.seller || null,
        representative: input.representative || null,
        internalNote: input.internalNote || null,
        orderNote: input.orderNote || null,
        active: true,
        createdAt: '2026-08-02T13:00:00.000Z',
        updatedAt: '2026-08-02T13:00:00.000Z',
      };
      customers.push(customer);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer } }),
      });
      return;
    }
    const updateMatch = pathname.match(/^\/api\/v1\/customers\/([^/]+)$/);
    if (updateMatch && request.method() === 'PATCH') {
      const input = request.postDataJSON() as Record<string, string | null>;
      const id = updateMatch[1] ?? '';
      customers = customers.map((customer) =>
        customer.id === id
          ? {
              ...customer,
              code: input.code?.toUpperCase() ?? customer.code,
              legalName: input.legalName ?? customer.legalName,
              cnpj: input.cnpj?.replace(/\D/g, '') || null,
              city: input.city || null,
              state: input.state?.toUpperCase() || null,
              segment: input.segment || null,
              customerClass:
                Object.values(customerClasses).find((item) => item.id === input.customerClassId) ??
                null,
              customerSegment:
                Object.values(customerSegments).find(
                  (item) => item.id === input.customerSegmentId,
                ) ?? null,
              seller: input.seller || null,
              representative: input.representative || null,
              internalNote: input.internalNote || null,
              orderNote: input.orderNote || null,
            }
          : customer,
      );
      const customer = customers.find((item) => item.id === id);
      await route.fulfill({
        status: customer ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer } }),
      });
      return;
    }
    const statusMatch = pathname.match(/^\/api\/v1\/customers\/([^/]+)\/(deactivate|activate)$/);
    if (statusMatch && request.method() === 'POST') {
      const id = statusMatch[1] ?? '';
      const active = statusMatch[2] === 'activate';
      customers = customers.map((customer) =>
        customer.id === id ? { ...customer, active } : customer,
      );
      const customer = customers.find((item) => item.id === id);
      await route.fulfill({
        status: customer ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer } }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/v1/calculations/50000000-0000-4000-8000-000000000001', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculation: {
            id: '50000000-0000-4000-8000-000000000001',
            version: 2,
            current: true,
            kitCode: '131507',
            kitDescription: 'KIT DE FREIO',
            priceList: {
              id: '20000000-0000-4000-8000-000000000001',
              code: 'IMPLEMENTER',
              name: 'Consumidor Final',
            },
            priceListVersion: {
              id: '30000000-0000-4000-8000-000000000001',
              version: 2,
            },
            minimumTotal: '18.1500',
            normalTotal: '35.2000',
            createdAt: '2026-09-15T12:00:00.000Z',
            items: [],
          },
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
  await page.route('**/api/v1/orders/price-lists**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: {
            id: initialCustomers[0]!.id,
            code: initialCustomers[0]!.code,
            legalName: initialCustomers[0]!.legalName,
            customerSegmentId: customerSegments.fleetOwner.id,
          },
          totalQuantity: 1,
          priceLists: [],
        },
      }),
    }),
  );

  await page.goto('/clientes');
  const screen = page.locator('#s-clientes');
  await expect(screen).toBeVisible();
  await expect(screen.locator('#customers-body .customer-row')).toHaveCount(3);
  await expect(screen.getByText('Clientes cadastrados')).toHaveCount(0);
  await expect(screen.getByRole('columnheader', { name: 'CNPJ' })).toBeVisible();
  await expect(screen.getByRole('columnheader', { name: 'Cidade' })).toBeVisible();
  await expect(screen.getByRole('columnheader', { name: 'UF' })).toBeVisible();
  await expect(screen.getByText('Expresso Figueiredo')).toBeVisible();
  const firstCustomerRow = screen.locator('tr', { hasText: 'Expresso Figueiredo' });
  await expect
    .poll(() =>
      firstCustomerRow.locator('.customer-actions-buttons .btn').evaluateAll((buttons) =>
        buttons.every((button) => {
          const style = getComputedStyle(button);
          return (
            Number.parseFloat(style.height) >= 22 &&
            Number.parseFloat(style.fontSize) >= 9 &&
            button.scrollWidth <= button.clientWidth
          );
        }),
      ),
    )
    .toBe(true);
  await expect(firstCustomerRow).toContainText('12.345.678/0001-90');
  await expect(firstCustomerRow).toContainText('São Paulo');
  await expect(firstCustomerRow).toContainText('SP');
  await expect
    .poll(() =>
      screen
        .locator('.customers-table-wrap')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  await expect(screen.locator('tr', { hasText: 'Expresso Figueiredo' })).toContainText(
    'Implementador',
  );
  await expect(screen.locator('tr', { hasText: 'M C Freimuth Ltda' })).toContainText(
    'Não classificado',
  );
  await firstCustomerRow.getByRole('button', { name: 'Visualizar' }).click();
  const linksModal = page.locator('#customer-links-modal');
  await expect(linksModal).toHaveClass(/open/);
  await expect(linksModal).toHaveCSS('opacity', '1');
  await expect(linksModal.getByRole('tab', { name: 'Informações' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(linksModal.getByText('12.345.678/0001-90')).toBeVisible();
  await expect(linksModal.getByText('São Paulo')).toBeVisible();
  const informationModalHeight = await linksModal
    .locator('.customer-links-modal')
    .evaluate((element) => element.getBoundingClientRect().height);
  await page.screenshot({ path: 'test-results/customer-details-info.png', fullPage: true });
  await linksModal.getByRole('tab', { name: 'Kits vinculados' }).click();
  await expect(linksModal.getByRole('tab', { name: 'Kits vinculados' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(linksModal.getByText('131507 · KIT DE FREIO')).toBeVisible();
  await expect(linksModal.getByText('16 itens')).toBeVisible();
  await expect
    .poll(() =>
      linksModal
        .locator('.customer-links-modal')
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(informationModalHeight);
  await page.screenshot({ path: 'test-results/customer-details-kits.png', fullPage: true });
  await expect(linksModal.getByText('300025')).toBeHidden();
  await linksModal.locator('summary', { hasText: '131507 · KIT DE FREIO' }).click();
  await expect(linksModal.getByText('300025')).toBeVisible();
  await expect(linksModal.getByText('FILTRO DE REDE M16')).toBeVisible();
  const kitScroll = linksModal.locator('.customer-calculation-content');
  await expect
    .poll(() =>
      kitScroll.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    )
    .toMatchObject({ clientHeight: expect.any(Number), scrollHeight: expect.any(Number) });
  expect(await kitScroll.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  );
  await kitScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => kitScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await linksModal.getByRole('button', { name: 'Gerar pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/novo/);
  expect(new URL(page.url()).searchParams.get('calculo')).toBe(
    '50000000-0000-4000-8000-000000000001',
  );
  expect(new URL(page.url()).searchParams.get('cliente')).toBe(
    '10000000-0000-4000-8000-000000000001',
  );
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
    '/clientes?cliente=10000000-0000-4000-8000-000000000001&aba=kits',
  );
  await expect(page.locator('#pedidoClienteTriggerLabel')).toHaveText('Expresso Figueiredo');
  await expect(page.locator('#pedidoItems')).toContainText('KIT DE FREIO');
  await expect(page.locator('#order-back')).toBeVisible();
  await page.locator('#order-back').click();
  await expect(page).toHaveURL('/clientes?cliente=10000000-0000-4000-8000-000000000001&aba=kits');
  await expect(linksModal).toHaveClass(/open/);
  await expect(linksModal.getByRole('tab', { name: 'Kits vinculados' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(linksModal.getByText(/131507.*KIT DE FREIO/)).toBeVisible();

  await page.goto('/clientes');
  await expect(screen).toBeVisible();
  await firstCustomerRow.getByRole('button', { name: 'Visualizar' }).click();
  await linksModal.getByRole('button', { name: 'Concluir' }).click();
  await expect(linksModal).not.toHaveClass(/open/);
  await expect(linksModal).toHaveCSS('opacity', '0');
  await expect(
    page.getByRole('navigation').getByRole('link', { name: /Clientes/ }),
  ).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: 'test-results/customers-database.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(screen.getByRole('button', { name: '+ Adicionar cliente' })).toBeVisible();
  await expect(screen.locator('#customers-search')).toBeVisible();
  await expect(firstCustomerRow.locator('[data-label="CNPJ"]')).toBeVisible();
  await expect(firstCustomerRow.locator('[data-label="Cidade"]')).toBeVisible();
  await expect(firstCustomerRow.locator('[data-label="UF"]')).toBeVisible();
  await expect
    .poll(() =>
      screen
        .locator('.customers-table-wrap')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/customers-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  await screen.locator('#customers-search').fill('Lider');
  await expect(screen.locator('#customers-body .customer-row')).toHaveCount(1);
  await expect(screen.getByText('Lider Sul Ltda')).toBeVisible();
  await screen.getByRole('button', { name: 'Limpar' }).click();
  await expect(screen.locator('#customers-body .customer-row')).toHaveCount(3);

  await screen.locator('#customers-class').selectOption(customerClasses.reseller.id);
  await expect(screen.locator('#customers-body .customer-row')).toHaveCount(1);
  await expect(screen.getByText('Lider Sul Ltda')).toBeVisible();
  await screen.getByRole('button', { name: 'Limpar' }).click();

  await screen.locator('#customers-class').selectOption(customerClasses.implementer.id);
  const downloadPromise = page.waitForEvent('download');
  await screen.getByRole('button', { name: 'Exportar base' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const csv = await readFile(downloadPath!, 'utf8');
  expect(csv).toContain('"Código";"Razão Social";"CNPJ";"Cidade";"Estado";"Classe";"Segmento"');
  expect(csv).toContain('"Implementador";"Frotista"');
  await expect(screen.getByText('1 cliente exportado.')).toBeVisible();
  expect(exportedClassId).toBe(customerClasses.implementer.id);
  await screen.getByRole('button', { name: 'Limpar' }).click();

  await screen.getByRole('button', { name: '+ Adicionar cliente' }).click();
  const formModal = page.locator('#customer-form-modal');
  await expect(formModal).toHaveClass(/open/);
  await formModal.getByLabel('Código').fill('c02000');
  await formModal.getByLabel('Razão social').fill('Cliente Novo Ltda');
  await formModal.getByLabel('CNPJ').fill('12345678000190');
  await expect(formModal.getByLabel('CNPJ')).toHaveValue('12.345.678/0001-90');
  await formModal.getByLabel('Cidade').fill('Curitiba');
  await formModal.getByLabel('Estado').fill('pr');
  await expect(formModal.getByLabel('Estado')).toHaveValue('PR');
  await formModal.getByLabel('Classe').selectOption(customerClasses.endConsumer.id);
  await formModal.getByLabel('Segmento').selectOption(customerSegments.autoParts.id);
  await page.screenshot({ path: 'test-results/customers-classification-form.png', fullPage: true });
  await formModal.getByLabel('Vendedor').fill('Allan');
  await formModal.getByLabel('Observação do perfil').fill('Cliente prefere contato por e-mail.');
  await formModal
    .getByLabel('Observação padrão do pedido')
    .fill('Separar a mercadoria por centro de custo.');
  await formModal.getByRole('button', { name: 'Adicionar cliente' }).click();
  await expect(screen.getByText('Cliente adicionado com sucesso.')).toBeVisible();
  await expect(screen.getByText('Cliente Novo Ltda')).toBeVisible();

  const createdRow = screen.locator('tr', { hasText: 'Cliente Novo Ltda' });
  await createdRow.getByRole('button', { name: 'Editar' }).click();
  const customerModalBox = await formModal.locator('.customer-modal').boundingBox();
  expect(customerModalBox).not.toBeNull();
  expect(customerModalBox!.width).toBeLessThanOrEqual(600);
  expect(customerModalBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 24);
  await expect(formModal.getByRole('button', { name: 'Salvar alterações' })).toBeVisible();
  await expect(formModal.getByLabel('Observação do perfil')).toHaveValue(
    'Cliente prefere contato por e-mail.',
  );
  await expect(formModal.getByLabel('Observação padrão do pedido')).toHaveValue(
    'Separar a mercadoria por centro de custo.',
  );
  await expect(formModal.getByLabel('Classe')).toHaveValue(customerClasses.endConsumer.id);
  await expect(formModal.getByLabel('Segmento')).toHaveValue(customerSegments.autoParts.id);
  await expect(formModal.getByLabel('CNPJ')).toHaveValue('12.345.678/0001-90');
  await expect(formModal.getByLabel('Cidade')).toHaveValue('Curitiba');
  await expect(formModal.getByLabel('Estado')).toHaveValue('PR');
  await formModal.getByLabel('Cidade').fill('Joinville');
  await formModal.getByLabel('Estado').fill('sc');
  await formModal.getByLabel('Razão social').fill('Cliente Atualizado Ltda');
  await formModal.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(screen.getByText('Cliente Atualizado Ltda')).toBeVisible();

  const updatedRow = screen.locator('tr', { hasText: 'Cliente Atualizado Ltda' });
  await updatedRow.getByRole('button', { name: 'Desativar' }).click();
  const statusModal = page.locator('#customer-status-modal');
  await expect(statusModal).toHaveClass(/open/);
  await statusModal.getByRole('button', { name: 'Desativar cliente' }).click();
  await expect(statusModal).not.toHaveClass(/open/);
  await expect(screen.getByText('Cliente desativado com sucesso.')).toBeVisible();
  await expect(screen.getByText('Cliente Atualizado Ltda')).toHaveCount(0);
});

test('usuário comum visualiza clientes sem ações administrativas', async ({ page }) => {
  await mockSession(page, {
    ...sessionUser,
    name: 'Usuário de consulta',
    email: 'consulta@fluair.test',
    roleCode: 'CALCULATION_OPERATOR',
    permissions: ['customer.view'],
  });
  await page.route('**/api/v1/customers**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/customers/classifications') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customerClasses: [], customerSegments: [] } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [initialCustomers[0]],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      }),
    });
  });

  await page.goto('/clientes');
  const screen = page.locator('#s-clientes');
  const row = screen.locator('tr', { hasText: 'Expresso Figueiredo' });
  await expect(row.getByRole('button', { name: 'Visualizar' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Desativar' })).toHaveCount(0);
  await expect(screen.getByRole('button', { name: '+ Adicionar cliente' })).toBeHidden();
});
