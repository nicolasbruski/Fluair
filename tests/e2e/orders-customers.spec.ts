import { expect, test, type Page } from '@playwright/test';

import type { Customer } from '../../src/shared/customers.js';
import type { OrderDraft, OrderDraftPayload } from '../../src/shared/orders.js';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora de Pedidos',
  email: 'pedidos@fluair.test',
  permissions: ['order.access', 'customer.view', 'price.view', 'price.override'],
};

const customers: Customer[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    code: 'C01619',
    legalName: 'Expresso Figueiredo',
    cnpj: '12345678000190',
    city: 'São Paulo',
    state: 'SP',
    segment: 'FROTISTA',
    customerClass: null,
    customerSegment: null,
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
    cnpj: '98765432000110',
    city: 'Curitiba',
    state: 'PR',
    segment: 'POSTO DE SERVICO',
    customerClass: null,
    customerSegment: null,
    seller: 'Marcelo Ort',
    representative: 'Progresso',
    internalNote: 'Cliente estratégico da região Sul.',
    orderNote: 'Conferir os volumes com o responsável no recebimento.',
    active: true,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    code: 'C09999',
    legalName: 'Cliente Desativado',
    cnpj: null,
    city: null,
    state: null,
    segment: null,
    customerClass: null,
    customerSegment: null,
    seller: null,
    representative: null,
    internalNote: null,
    orderNote: null,
    active: false,
    createdAt: '2026-08-02T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/media/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/v1/order-price-approvals**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { customer: null, products: [], calculatedProducts: [], kits: [] },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 0,
          productTotalPages: 0,
          calculatedProductTotal: 0,
          kitTotal: 0,
          kitTotalPages: 0,
        },
      }),
    }),
  );
});

test('exibe fotos de kit e produto no drawer sem adicionar ao ampliar e preserva no carrinho', async ({
  page,
}) => {
  await mockSession(page);
  const image = (id: string) => ({
    id,
    thumbnailUrl: `/api/v1/media/${id}/thumb`,
    displayUrl: `/api/v1/media/${id}/display`,
    width: 800,
    height: 600,
    updatedAt: '2026-09-22T12:00:00.000Z',
  });
  await page.route('**/api/v1/customers**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: null,
          products: [
            {
              kind: 'STANDALONE_PRODUCT',
              productId: 'product-1',
              code: 'P-FOTO',
              description: 'Produto com foto',
              reference: 'REF-FOTO',
              unitPrice: '25',
              minimumPrice: '25',
              maximumPrice: '25',
              priceRanges: [],
              ipiRate: '0',
              ipiIncluded: true,
              icmsRate: '0',
              priceListVersionId: 'version-product',
              priceListVersion: 1,
              priceList: { id: 'list-product', code: 'AV', name: 'Avulsos' },
              image: image('image-product'),
            },
          ],
          kits: [
            {
              kind: 'KIT',
              calculationId: 'calculation-kit',
              calculationVersion: 2,
              code: 'K-FOTO',
              description: 'Kit com foto',
              minimumPrice: '100',
              normalPrice: '120',
              scope: 'STANDARD',
              calculatedAt: '2026-09-20T12:00:00.000Z',
              priceList: { id: 'list-kit', code: 'KIT', name: 'Kits', type: 'KIT_COMPONENT' },
              priceListVersion: { id: 'version-kit', version: 3 },
              image: image('image-kit'),
            },
          ],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 1,
          productTotalPages: 1,
          kitTotal: 1,
          kitTotalPages: 1,
        },
      }),
    }),
  );

  await page.goto('/pedidos/novo');
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  const drawer = page.locator('#order-drawer');
  const productPhoto = drawer.getByRole('button', { name: 'Ampliar foto de Produto P-FOTO' });
  await expect(productPhoto).toHaveCSS('padding', '4px');
  await expect(productPhoto.locator('img')).toHaveCSS('object-fit', 'contain');
  await expect(productPhoto.locator('img')).toHaveCSS('object-position', '50% 50%');
  const [photoBox, imageBox] = await Promise.all([
    productPhoto.boundingBox(),
    productPhoto.locator('img').boundingBox(),
  ]);
  expect(photoBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.width).toBeLessThanOrEqual(photoBox!.width - 8);
  expect(imageBox!.height).toBeLessThanOrEqual(photoBox!.height - 8);
  await productPhoto.click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await expect(page.locator('#media-image-viewer')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Fechar imagem ampliada' }).click();
  await drawer.getByRole('button', { name: 'Adicionar K-FOTO ao pedido' }).click();
  await drawer.getByRole('button', { name: 'Adicionar P-FOTO ao pedido' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('2');
  await expect(page.locator('#pedidoItems img[src*="image-kit/thumb"]')).toBeVisible();
  await expect(page.locator('#pedidoItems img[src*="image-product/thumb"]')).toBeVisible();
  await page.getByLabel('Quantidade de P-FOTO').fill('3');
  await page.getByLabel('Quantidade de P-FOTO').press('Tab');
  await expect(page.locator('#pedidoItems img[src*="image-product/thumb"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#pedidoItems .order-cart-summary')).toHaveCount(2);
  await page.screenshot({ path: 'tmp/task-004-orders-mobile.png', fullPage: true });
});

async function mockSession(page: Page, sessionUser = user): Promise<void> {
  let draft: OrderDraft | null = null;
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: sessionUser,
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/draft**', async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      draft = null;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (request.method() === 'POST') {
      const input = request.postDataJSON() as {
        targetCustomerId: string;
        current?: { customerId: string; payload: OrderDraftPayload };
      };
      const restored = draft?.customer?.id === input.targetCustomerId ? draft : null;
      if (input.current) {
        const customer = customers.find((item) => item.id === input.current!.customerId);
        draft = {
          id: 'd0000000-0000-4000-8000-000000000001',
          revision: Number(draft?.revision ?? 0) + 1,
          customer: {
            id: input.current.customerId,
            code: customer?.code ?? 'SALVO',
            legalName: customer?.legalName ?? 'Cliente salvo',
            active: true,
          },
          payload: input.current.payload,
          updatedAt: '2026-10-02T15:00:00.000Z',
        };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { restored, draft } }),
      });
      return;
    }
    if (request.method() === 'PUT') {
      const input = request.postDataJSON() as {
        customerId: string;
        payload: OrderDraftPayload;
      };
      const customer = customers.find((item) => item.id === input.customerId);
      draft = {
        id: 'd0000000-0000-4000-8000-000000000001',
        revision: Number(draft?.revision ?? 0) + 1,
        customer: {
          id: input.customerId,
          code: customer?.code ?? 'SALVO',
          legalName: customer?.legalName ?? 'Cliente salvo',
          active: true,
        },
        payload: input.payload,
        updatedAt: '2026-10-02T15:00:00.000Z',
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { draft } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { draft } }),
    });
  });
}

test('exibe no drawer o valor do produto avulso em todas as faixas compatíveis', async ({
  page,
}) => {
  await mockSession(page);
  await page.route('**/api/v1/customers**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: null,
          products: [
            {
              kind: 'STANDALONE_PRODUCT',
              productId: 'p1',
              code: 'P-FAIXAS',
              description: 'Produto com preços por faixa',
              reference: 'REF-1',
              unitPrice: '49.90',
              minimumPrice: '39.90',
              maximumPrice: '49.90',
              priceRanges: [
                {
                  priceList: { id: 'l5', code: 'INDUSTRY_PRODUCTS', name: 'Indústria' },
                  priceListVersionId: 'v5',
                  priceListVersion: 1,
                  minimumOrderQuantity: null,
                  maximumOrderQuantity: null,
                  minimumPrice: '39.90',
                  maximumPrice: '54.90',
                  ipiRate: '0',
                  icmsRate: '0',
                },
                {
                  priceList: { id: 'l3', code: 'L-100', name: 'Lista 100+' },
                  priceListVersionId: 'v3',
                  priceListVersion: 1,
                  minimumOrderQuantity: 100,
                  maximumOrderQuantity: null,
                  minimumPrice: '39.90',
                  maximumPrice: '39.90',
                  ipiRate: '0',
                  icmsRate: '0',
                },
                {
                  priceList: { id: 'l4', code: 'EXPORT_PRODUCTS', name: 'Exportação' },
                  priceListVersionId: 'v4',
                  priceListVersion: 1,
                  minimumOrderQuantity: null,
                  maximumOrderQuantity: null,
                  minimumPrice: '39.90',
                  maximumPrice: '55.00',
                  ipiRate: '0',
                  icmsRate: '0',
                },
                {
                  priceList: { id: 'l1', code: 'L-049', name: 'Lista 0-49' },
                  priceListVersionId: 'v1',
                  priceListVersion: 1,
                  minimumOrderQuantity: 0,
                  maximumOrderQuantity: 49,
                  minimumPrice: '39.90',
                  maximumPrice: '49.90',
                  ipiRate: '0',
                  icmsRate: '0',
                },
                {
                  priceList: { id: 'l2', code: 'L-5099', name: 'Lista 50-99' },
                  priceListVersionId: 'v2',
                  priceListVersion: 1,
                  minimumOrderQuantity: 50,
                  maximumOrderQuantity: 99,
                  minimumPrice: '39.90',
                  maximumPrice: '44.00',
                  ipiRate: '17.5',
                  icmsRate: '0',
                },
              ],
              ipiRate: '0',
              ipiIncluded: true,
              icmsRate: '0',
              priceListVersionId: 'v1',
              priceListVersion: 1,
              priceList: { id: 'l1', code: 'L-049', name: 'Lista 0-49' },
            },
          ],
          kits: [],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 1,
          productTotalPages: 1,
          kitTotal: 0,
          kitTotalPages: 1,
        },
      }),
    }),
  );

  await page.goto('/pedidos/novo');
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  const prices = page.locator('#order-drawer .order-card-price-range');
  await expect(prices).toHaveText([
    'Exportação: R$ 55,00',
    'Indústria: R$ 54,90',
    '0-49: R$ 49,90',
    '50-99: R$ 44,00',
    '100+: R$ 39,90',
  ]);
  const cardWidth = await page
    .getByRole('button', { name: 'Adicionar P-FAIXAS ao pedido' })
    .evaluate((element) => element.getBoundingClientRect().width);
  for (const price of await prices.all())
    expect(await price.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(
      cardWidth / 2,
    );
  await page.locator('label[for="order-hide-reference-prices"]').click();
  for (const price of await prices.all()) await expect(price).toBeVisible();
  await page
    .getByRole('button', { name: /Adicionar P-FAIXAS por R\$\s*44,00 da lista Lista 50-99/ })
    .click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('1');
  await expect(page.getByLabel('Quantidade de P-FAIXAS')).toHaveValue('1');
  await expect(page.getByLabel('Preço unitário de P-FAIXAS')).toHaveValue('44,00');
  await expect(page.getByLabel('Imposto percentual de P-FAIXAS')).toHaveValue('17.50');
  await expect(page.locator('#pedidoSubNor')).toHaveText(/R\$\s*44,00/);
});

test('pré-cadastra e seleciona um cliente na tela de Pedidos', async ({ page }) => {
  const administrator = {
    ...user,
    roleCode: 'ADMINISTRATOR',
    permissions: [...user.permissions, 'customer.manage'],
  };
  const createdCustomer: Customer = {
    id: '10000000-0000-4000-8000-000000000010',
    code: 'PRE-1234567890ABCDEF',
    legalName: 'Cliente Rápido Ltda',
    cnpj: null,
    city: null,
    state: null,
    segment: null,
    customerClass: {
      id: '30000000-0000-4000-8000-000000000001',
      code: 'IMPLEMENTER',
      name: 'Implementador',
      active: true,
    },
    customerSegment: {
      id: '40000000-0000-4000-8000-000000000001',
      code: 'FLEET_OWNER',
      name: 'Frotista',
      active: true,
    },
    seller: null,
    representative: null,
    internalNote: null,
    orderNote: null,
    active: true,
    createdAt: '2026-09-17T12:00:00.000Z',
    updatedAt: '2026-09-17T12:00:00.000Z',
  };
  let submitted: unknown;

  await mockSession(page, administrator);
  await page.route('**/api/v1/customers**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/classifications')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            customerClasses: [createdCustomer.customerClass],
            customerSegments: [createdCustomer.customerSegment],
          },
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/pre-registration')) {
      submitted = request.postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer: createdCustomer } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        },
      }),
    });
  });
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
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/price-lists**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { customer: createdCustomer, totalQuantity: 0, priceLists: [] },
      }),
    }),
  );

  await page.goto('/pedidos/novo');
  await expect(page.locator('#order-back')).toBeHidden();
  await page.getByRole('button', { name: 'Pré cadastro de cliente' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pré-cadastrar cliente' });
  await dialog.getByLabel('Razão social').fill('Cliente Rápido Ltda');
  await dialog.getByLabel('Classe').selectOption(createdCustomer.customerClass!.id);
  await dialog.getByLabel('Segmento').selectOption(createdCustomer.customerSegment!.id);
  await dialog.getByRole('button', { name: 'Salvar e selecionar' }).click();

  await expect(page.locator('#order-customer-pre-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#pedidoCliente')).toHaveValue(createdCustomer.id);
  await expect(page.locator('#pedidoClienteTriggerLabel')).toHaveText('Cliente Rápido Ltda');
  expect(submitted).toEqual({
    legalName: 'Cliente Rápido Ltda',
    customerClassId: createdCustomer.customerClass!.id,
    customerSegmentId: createdCustomer.customerSegment!.id,
  });
});

test('busca e seleciona clientes ativos do cadastro real na tela de Pedidos', async ({ page }) => {
  const queries: URLSearchParams[] = [];
  await mockSession(page);
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
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/price-lists**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { customer: {}, totalQuantity: 0, priceLists: [] } }),
    }),
  );
  await page.route('**/api/v1/customers**', async (route) => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams);
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('pt-BR');
    const filtered = customers.filter(
      (customer) =>
        customer.active &&
        (!search ||
          customer.code.toLocaleLowerCase('pt-BR').includes(search) ||
          customer.legalName.toLocaleLowerCase('pt-BR').includes(search)),
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: filtered,
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: {
            page: 1,
            pageSize: 25,
            total: filtered.length,
            totalPages: 1,
          },
        },
      }),
    });
  });

  await page.goto('/pedidos/novo');
  await page.locator('#pedido-client-trigger').click();
  await expect(page.getByRole('option', { name: /Expresso Figueiredo/ })).toBeVisible();
  await expect(
    page.getByRole('option', { name: /Expresso Figueiredo/ }).locator('.cliente-option-code'),
  ).toHaveText('C01619');
  await expect(page.locator('.cliente-option-avatar')).toHaveCount(0);
  await expect(page.getByText('Cliente Desativado')).toHaveCount(0);
  await expect(page.getByText('Implementador Exemplo Ltda.')).toHaveCount(0);

  await page.locator('#pedidoClienteSearch').fill('Lider');
  await expect.poll(() => queries.length).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('option', { name: /Lider Sul Ltda/ })).toBeVisible();
  await page.getByRole('option', { name: /Lider Sul Ltda/ }).click();

  await expect(page.locator('#pedidoCliente')).toHaveValue(customers[1]!.id);
  await expect(page.locator('.cliente-select-avatar')).toHaveCount(0);
  await expect(page.locator('#pedidoClienteTriggerLabel')).toHaveText('Lider Sul Ltda');
  await expect(page.locator('#pedidoClienteTriggerMeta')).toHaveText(
    'CNPJ: 98.765.432/0001-10 · Cidade/Estado: Curitiba/PR',
  );
  await expect(page.locator('#pedido-client-clear')).toHaveCSS('display', 'flex');
  await expect(page.locator('#pedido-client-clear')).toBeVisible();
  const arrowBox = await page.locator('#pedido-client-trigger .cliente-select-arrow').boundingBox();
  const clearBox = await page.locator('#pedido-client-clear').boundingBox();
  expect(arrowBox).not.toBeNull();
  expect(clearBox).not.toBeNull();
  expect(
    Math.abs(arrowBox!.y + arrowBox!.height / 2 - (clearBox!.y + clearBox!.height / 2)),
  ).toBeLessThanOrEqual(1);
  await expect(page.locator('#pedidoObs')).toHaveValue(customers[1]!.orderNote ?? '');
  await expect(page.locator('#pedidoClientePicker')).not.toHaveClass(/open/);
  await page.locator('#pedido-client-clear').click();
  await expect(page.locator('#pedidoCliente')).toHaveValue('');
  await expect(page.locator('#pedidoClienteTriggerLabel')).toHaveText(
    'Escolha um cliente para este pedido',
  );
  await expect(page.locator('#pedido-client-clear')).toBeHidden();
  await expect(page.locator('#pedidoObs')).toHaveValue('');
  expect(queries.length).toBeGreaterThanOrEqual(2);
  expect(queries.every((query) => query.get('status') === 'active')).toBe(true);
});

test('remove o usuário incorporado à descrição no drawer e no carrinho', async ({ page }) => {
  await mockSession(page);
  await page.route('**/api/v1/customers**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: null,
          standalonePriceList: null,
          products: [],
          calculatedProducts: [],
          kits: [
            {
              kind: 'KIT',
              calculationId: '80000000-0000-4000-8000-000000000001',
              calculationVersion: 3,
              code: 'K-200',
              description: 'Kit calculado real Usuario:\nSAMARA',
              minimumPrice: '100',
              normalPrice: '120',
              calculatedAt: '2026-08-15T14:30:00.000Z',
              scope: 'CUSTOMER_SPECIFIC',
              priceList: { id: '9', code: 'KIT', name: 'Componentes autorizados' },
              priceListVersion: {
                id: '90000000-0000-4000-8000-000000000001',
                version: 6,
              },
            },
          ],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 0,
          productTotalPages: 1,
          calculatedProductTotal: 0,
          kitTotal: 1,
          kitTotalPages: 1,
        },
      }),
    }),
  );

  await page.goto('/pedidos/novo');
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  const drawer = page.locator('#order-drawer');
  const kitCard = drawer.getByRole('button', { name: 'Adicionar K-200 ao pedido' });
  await expect(kitCard.locator('.item-desc')).toHaveText('Kit calculado real');
  await kitCard.click();
  await drawer.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#pedidoItems .order-cart-desc')).toHaveText(
    'K-200 · Kit calculado real',
  );
  await expect(page.locator('#pedidoItems')).not.toContainText(/Usu[aá]rio:/i);
});

test('carrega o catálogo agregado e monta carrinho misto rastreável', async ({ page }) => {
  await mockSession(page);
  const oneListCustomer: Customer = {
    ...customers[0]!,
    id: '10000000-0000-4000-8000-000000000004',
    code: 'C00004',
    legalName: 'Cliente Uma Lista',
  };
  await page.route('**/api/v1/customers**', (route) => {
    if (new URL(route.request().url()).pathname.endsWith(`/${oneListCustomer.id}`)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customer: oneListCustomer } }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [...customers.filter(({ active }) => active), oneListCustomer],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 3, totalPages: 1 },
        },
      }),
    });
  });
  let catalogRequests = 0;
  let savedCatalogRequests = 0;
  let createdOrders = 0;
  const orderIdempotencyKeys: string[] = [];
  const catalogSearches: string[] = [];
  await page.route('**/api/v1/orders/price-lists**', async (route) => {
    const searchParams = new URL(route.request().url()).searchParams;
    const customerId = searchParams.get('customerId');
    const totalQuantity = searchParams
      .getAll('quantity')
      .reduce((total, quantity) => total + Number(quantity), 0);
    const availableLists = [
      {
        id: '60000000-0000-4000-8000-000000000001',
        code: 'AV-A',
        name: 'Avulsos A',
        type: 'STANDALONE_PRODUCT',
        minimumOrderQuantity: null,
        maximumOrderQuantity: 99,
        activeVersion: { id: '70000000-0000-4000-8000-000000000001', version: 2 },
      },
      {
        id: '60000000-0000-4000-8000-000000000002',
        code: 'AV-B',
        name: 'Avulsos B',
        type: 'STANDALONE_PRODUCT',
        minimumOrderQuantity: 100,
        maximumOrderQuantity: null,
        activeVersion: { id: '70000000-0000-4000-8000-000000000002', version: 4 },
      },
      {
        id: '60000000-0000-4000-8000-000000000003',
        code: 'AV-C',
        name: 'Avulsos sem faixa',
        type: 'STANDALONE_PRODUCT',
        minimumOrderQuantity: null,
        maximumOrderQuantity: null,
        activeVersion: { id: '70000000-0000-4000-8000-000000000003', version: 1 },
      },
    ];
    const lists =
      customerId === customers[0]!.id
        ? []
        : customerId === oneListCustomer.id
          ? availableLists.slice(0, 1)
          : availableLists.filter(
              ({ minimumOrderQuantity, maximumOrderQuantity }) =>
                (minimumOrderQuantity === null || totalQuantity >= minimumOrderQuantity) &&
                (maximumOrderQuantity === null || totalQuantity <= maximumOrderQuantity),
            );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { customer: {}, totalQuantity, priceLists: lists } }),
    });
  });
  await page.route('**/api/v1/orders/saved-catalog**', async (route) => {
    savedCatalogRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculatedProducts: [
            {
              kind: 'CALCULATED_PRODUCT',
              calculationItemId: '81000000-0000-4000-8000-000000000001',
              productId: 'p2',
              code: 'P-200',
              description: 'Componente carregado ao entrar',
              unit: 'UN',
              minimumPrice: '15.00',
              normalPrice: '18.00',
              calculatedAt: '2026-08-15T14:30:00.000Z',
              priceList: {
                id: '9',
                code: 'KIT',
                name: 'Componentes autorizados',
                type: 'KIT_COMPONENT',
              },
              priceListVersion: {
                id: '90000000-0000-4000-8000-000000000001',
                version: 6,
              },
              kits: [{ code: 'K-200', description: 'Kit calculado real' }],
            },
          ],
          kits: [],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          calculatedProductTotal: 1,
          calculatedProductTotalPages: 1,
          kitTotal: 0,
        },
      }),
    });
  });
  await page.route('**/api/v1/orders/catalog**', async (route) => {
    catalogRequests += 1;
    catalogSearches.push(new URL(route.request().url()).searchParams.get('search') ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: {
            id: customers[0]!.id,
            code: customers[0]!.code,
            legalName: customers[0]!.legalName,
          },
          standalonePriceList: {},
          products: [
            {
              kind: 'STANDALONE_PRODUCT',
              productId: 'p1',
              code: 'P-100',
              description: 'Válvula real',
              reference: 'REF-X',
              unitPrice: '25.50',
              minimumPrice: '22.00',
              maximumPrice: '25.50',
              priceRanges: [
                {
                  priceList: {
                    id: '61000000-0000-4000-8000-000000000001',
                    code: 'AV-A',
                    name: 'Revenda 100+',
                  },
                  priceListVersionId: '71000000-0000-4000-8000-000000000001',
                  priceListVersion: 1,
                  minimumOrderQuantity: 100,
                  maximumOrderQuantity: null,
                  minimumPrice: '22.00',
                  maximumPrice: '25.50',
                  ipiRate: '3.25',
                  icmsRate: '12',
                },
                {
                  priceList: {
                    id: '62000000-0000-4000-8000-000000000001',
                    code: 'AV-B',
                    name: 'Revenda até 49 peças',
                  },
                  priceListVersionId: '70000000-0000-4000-8000-000000000001',
                  priceListVersion: 2,
                  minimumOrderQuantity: 50,
                  maximumOrderQuantity: 99,
                  minimumPrice: '22.00',
                  maximumPrice: '25.50',
                  ipiRate: '5',
                  icmsRate: '18',
                },
              ],
              ipiRate: '5',
              ipiIncluded: true,
              icmsRate: '18',
              priceListVersionId: '70000000-0000-4000-8000-000000000001',
              priceListVersion: 2,
              priceList: {
                id: '62000000-0000-4000-8000-000000000001',
                code: 'AV-B',
                name: 'Lista avulsa B',
              },
              image: {
                id: 'image-product-catalog',
                thumbnailUrl: '/api/v1/media/image-product-catalog/thumb',
                displayUrl: '/api/v1/media/image-product-catalog/display',
                width: 900,
                height: 700,
                updatedAt: '2026-09-20T12:00:00.000Z',
              },
            },
          ],
          calculatedProducts: [
            {
              kind: 'CALCULATED_PRODUCT',
              calculationItemId: '81000000-0000-4000-8000-000000000001',
              productId: 'p2',
              code: 'P-200',
              description: 'Componente persistido',
              unit: 'UN',
              minimumPrice: '15.00',
              normalPrice: '18.00',
              calculatedAt: '2026-08-15T14:30:00.000Z',
              priceList: {
                id: '9',
                code: 'KIT',
                name: 'Componentes autorizados',
                type: 'KIT_COMPONENT',
              },
              priceListVersion: {
                id: '90000000-0000-4000-8000-000000000001',
                version: 6,
              },
              kits: [{ code: 'K-200', description: 'Kit calculado real' }],
            },
          ],
          kits: [
            {
              kind: 'KIT',
              calculationId: '80000000-0000-4000-8000-000000000001',
              calculationVersion: 3,
              code: 'K-200',
              description: 'Kit calculado real',
              minimumPrice: '100',
              normalPrice: '120',
              calculatedAt: '2026-08-15T14:30:00.000Z',
              priceList: {
                id: '9',
                code: 'KIT',
                name: 'Componentes autorizados',
                type: 'KIT_COMPONENT',
              },
              priceListVersion: { id: '90000000-0000-4000-8000-000000000001', version: 6 },
              image: {
                id: 'image-kit-catalog',
                thumbnailUrl: '/api/v1/media/image-kit-catalog/thumb',
                displayUrl: '/api/v1/media/image-kit-catalog/display',
                width: 1200,
                height: 800,
                updatedAt: '2026-09-20T12:00:00.000Z',
              },
            },
          ],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 1,
          productTotalPages: 1,
          calculatedProductTotal: 1,
          kitTotal: 1,
        },
      }),
    });
  });
  await page.route('**/api/v1/orders/last-sale-prices', async (route) => {
    const input = route.request().postDataJSON() as {
      lines: Array<{ key: string; kind: 'KIT' | 'STANDALONE_PRODUCT' }>;
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          prices: input.lines.map((line) => ({
            key: line.key,
            lastOrderPrice: {
              unitPrice: line.kind === 'KIT' ? '115.0000' : '24.5000',
              orderId: '93000000-0000-4000-8000-000000000001',
              orderNumber: 'PED-2026-000099',
              orderedAt: '2026-10-01T15:00:00.000Z',
            },
          })),
        },
      }),
    });
  });
  await page.route('**/api/v1/orders/quote', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: {
            id: customers[0]!.id,
            code: customers[0]!.code,
            legalName: customers[0]!.legalName,
          },
          creator: { id: user.id, name: user.name, email: user.email },
          recipients: [user.email, 'nicolasbruski7@gmail.com'],
          quoteToken: 'quote-token-for-e2e-confirmation',
          expiresAt: '2026-09-13T12:10:00.000Z',
          differences: [],
          standalonePriceList: {
            id: '60000000-0000-4000-8000-000000000001',
            code: 'AV-A',
            name: 'Avulsos A',
            activeVersion: { id: '70000000-0000-4000-8000-000000000001', version: 2 },
          },
          totalQuantity: 2,
          lines: [
            {
              kind: 'KIT',
              calculationId: '80000000-0000-4000-8000-000000000001',
              calculationVersion: 3,
              code: 'K-200',
              description: 'Kit calculado real',
              priceReference: 'NORMAL',
              quantity: 1,
              unitPrice: '120.0000',
              referenceUnitPrice: '120.0000',
              negotiatedUnitPrice: '120.0000',
              subtotal: '120.0000',
              priceList: {
                id: '9',
                code: 'KIT',
                name: 'Componentes autorizados',
                type: 'KIT_COMPONENT',
              },
              priceListVersion: {
                id: '90000000-0000-4000-8000-000000000001',
                version: 6,
              },
              image: {
                id: 'image-kit-quote',
                thumbnailUrl: '/api/v1/media/image-kit-quote/thumb',
                displayUrl: '/api/v1/media/image-kit-quote/display',
                width: 1200,
                height: 800,
                updatedAt: '2026-09-22T12:00:00.000Z',
              },
            },
            {
              kind: 'STANDALONE_PRODUCT',
              productCode: 'P-100',
              description: 'Válvula real',
              reference: 'REF-X',
              quantity: 1,
              unitPrice: '26.0000',
              referenceUnitPrice: '26.0000',
              negotiatedUnitPrice: '26.0000',
              subtotal: '26.0000',
              ipiRate: '5.0000',
              ipiIncluded: true,
              icmsRate: '18.0000',
              priceList: {
                id: '60000000-0000-4000-8000-000000000001',
                code: 'AV-A',
                name: 'Avulsos A',
              },
              priceListVersion: {
                id: '70000000-0000-4000-8000-000000000001',
                version: 2,
              },
              image: {
                id: 'image-product-quote',
                thumbnailUrl: '/api/v1/media/image-product-quote/thumb',
                displayUrl: '/api/v1/media/image-product-quote/display',
                width: 900,
                height: 700,
                updatedAt: '2026-09-22T12:00:00.000Z',
              },
            },
          ],
          total: '146.0000',
          referenceTotal: '146.0000',
          warnings: ['O IPI já está incluído.'],
          quotedAt: '2026-09-13T12:00:00.000Z',
        },
      }),
    });
  });
  await page.route('**/api/v1/orders', async (route) => {
    createdOrders += 1;
    orderIdempotencyKeys.push(route.request().headers()['idempotency-key'] ?? '');
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (createdOrders === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          order: {
            id: '91000000-0000-4000-8000-000000000001',
            number: 'PED-2026-000001',
            status: 'SUBMITTED',
            submittedAt: '2026-09-13T12:00:00.000Z',
          },
          emailDelivery: {
            id: '92000000-0000-4000-8000-000000000001',
            status: 'PENDING',
            recipients: [user.email, 'nicolasbruski7@gmail.com'],
          },
          replayed: false,
        },
      }),
    });
  });
  await page.route('**/api/v1/orders/91000000-0000-4000-8000-000000000001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          order: { id: '91000000-0000-4000-8000-000000000001' },
          emailDeliveries: [
            {
              id: '92000000-0000-4000-8000-000000000001',
              status: 'FAILED',
              recipients: [user.email, 'nicolasbruski7@gmail.com'],
              attemptCount: 5,
              publicError: 'O provedor recusou o envio do pedido.',
              acceptedAt: null,
              deliveredAt: null,
              failedAt: '2026-09-13T12:01:00.000Z',
              bouncedAt: null,
              createdAt: '2026-09-13T12:00:00.000Z',
            },
          ],
        },
      }),
    });
  });

  await page.goto('/pedidos/novo');
  const drawer = page.locator('#order-drawer');
  await expect(page.getByText('2 · Lista de preço e itens do pedido')).toHaveCount(0);
  expect(savedCatalogRequests).toBe(0);
  await expect.poll(() => catalogRequests).toBe(1);
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.getByText('Kit calculado real')).toBeVisible();
  await drawer.getByRole('button', { name: 'Adicionar K-200 ao pedido' }).click();
  await drawer.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('1');
  await expect(page.locator('#pedidoItems')).toContainText('Kit calculado real');
  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: /Expresso Figueiredo/ }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');

  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: /Cliente Uma Lista/ }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  await expect(drawer.getByText('Válvula real')).toBeVisible();
  await drawer.getByRole('button', { name: 'Adicionar K-200 ao pedido' }).click();
  await drawer.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('1');

  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: /Lider Sul Ltda/ }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await expect(page.locator('#order-saved-draft')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('1');
  await expect(page.locator('#pedidoItems')).toContainText('Kit calculado real');
  await page.locator('#pedido-client-clear').click();
  await expect(page.locator('#pedidoCliente')).toHaveValue('');
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await expect(page.locator('#order-saved-draft')).toBeVisible();
  await page.getByRole('button', { name: 'Retomar' }).click();
  await expect(page.locator('#pedidoCliente')).toHaveValue(oneListCustomer.id);
  await expect(page.locator('#pedidoCartBadge')).toHaveText('1');
  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: /Lider Sul Ltda/ }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  await expect(drawer.getByText('Kit calculado real')).toBeVisible();
  await expect(drawer.getByText('Válvula real')).toBeVisible();
  await expect(drawer.getByText('Kit do cliente', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Produto avulso', { exact: true })).toBeVisible();
  await expect(drawer.getByText('50-99: R$ 25,50', { exact: true })).toBeVisible();
  await expect(drawer.getByText('100+: R$ 25,50', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Kits' })).toBeVisible();
  await expect(drawer.locator('.order-card-prices .reference-price').first()).toBeVisible();
  await drawer.locator('label[for="order-hide-reference-prices"]').click();
  await expect(drawer.locator('.order-card-prices .reference-price').first()).toBeHidden();
  await expect(page.locator('#hide-reference-prices')).toBeChecked();
  await drawer.locator('label[for="order-hide-reference-prices"]').click();
  await expect(drawer.locator('.order-card-prices .reference-price').first()).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Válvulas' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Válvulas' }).click();
  await expect(drawer.getByText('Válvula real')).toBeVisible();
  await expect(drawer.getByText('Kit calculado real')).toHaveCount(0);
  await drawer.getByRole('button', { name: 'Todos' }).click();
  await drawer.getByRole('button', { name: 'Ampliar foto de Kit K-200' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('0');
  await expect(page.locator('#media-image-viewer')).toHaveClass(/open/);
  await page.getByRole('button', { name: 'Fechar imagem ampliada' }).click();
  await drawer.getByRole('button', { name: 'Adicionar K-200 ao pedido' }).click();
  await drawer.getByRole('button', { name: 'Adicionar P-100 ao pedido' }).click();
  await drawer.getByRole('button', { name: 'Fechar' }).click();
  await expect(page.locator('#pedidoCartBadge')).toHaveText('2');
  await expect(page.locator('#pedidoItems')).toContainText('cálculo');
  await expect(page.locator('#pedidoItems')).toContainText('calculado em 15/08/2026');
  await expect(page.locator('#pedidoItems')).toContainText('Mínimo R$ 100,00');
  await expect(page.locator('#pedidoItems')).toContainText('Máximo R$ 120,00');
  await expect(page.locator('#pedidoItems')).toContainText('último pedido R$ 115,00');
  await expect(page.locator('#pedidoItems')).toContainText('último pedido R$ 24,50');
  await expect(page.locator('#pedidoItems .order-cart-last-price').first()).toHaveAttribute(
    'title',
    'PED-2026-000099 · 01/10/2026',
  );
  await expect(page.locator('#pedidoItems')).toContainText(
    'Revenda 100+ · Mínimo R$ 22,00 · Máximo R$ 25,50 · IPI 3,25% · ICMS 12%',
  );
  await expect(page.locator('#pedidoItems')).toContainText(
    'Revenda até 49 peças · Mínimo R$ 22,00 · Máximo R$ 25,50 · IPI 5% · ICMS 18%',
  );
  await expect(page.locator('#pedidoItems')).toContainText(
    'Impostos da lista selecionada: IPI 5% · ICMS 18%',
  );
  await expect(page.locator('#pedidoItems')).not.toContainText('origem');
  await expect(page.locator('#pedidoItems .order-cart-reference-prices').first()).toHaveCSS(
    'display',
    'block',
  );
  await expect(page.locator('#pedidoItems .order-cart-price-minimum').first()).toHaveCSS(
    'color',
    'rgb(110, 110, 115)',
  );
  await expect(page.locator('#pedidoItems .order-cart-price-normal').first()).toHaveCSS(
    'color',
    'rgb(110, 110, 115)',
  );
  await page.locator('label[for="hide-reference-prices"]').click();
  await expect(page.locator('#pedidoItems .reference-price').first()).toBeHidden();
  await page.locator('label[for="hide-reference-prices"]').click();
  await expect(page.locator('#pedidoItems .reference-price').first()).toBeVisible();
  await expect(page.locator('#pedidoItems')).toContainText('Kit');
  await expect(page.locator('#pedidoItems')).toContainText('Produto');
  await expect(page.getByLabel('Imposto percentual de P-100')).toHaveValue('5.00');
  await page.getByLabel('Preço unitário de P-100').fill('30,00');
  await expect(page.locator('#pedidoSubNor')).toHaveText(/R\$\s*150,00/);
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  await drawer.getByRole('searchbox', { name: 'Buscar itens do pedido' }).fill('REF-X');
  await expect.poll(() => catalogSearches).toContain('REF-X');
  await drawer.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Gerar pedido' }).click();
  const review = page.locator('#order-review-modal');
  await expect(page.locator('#order-quote-feedback')).toContainText('Cotação validada');
  await expect(review).toHaveClass(/open/);
  await expect(review).toContainText('nicolasbruski7@gmail.com');
  expect(createdOrders).toBe(0);
  await review.getByRole('button', { name: 'Voltar e revisar' }).click();
  expect(createdOrders).toBe(0);
  await page.getByRole('button', { name: 'Gerar pedido' }).click();
  await review.getByRole('button', { name: 'Confirmar e enviar pedido' }).click();
  await expect(review.locator('#order-review-status')).toContainText(
    'temporariamente indisponível',
  );
  expect(createdOrders).toBe(1);
  await review.getByRole('button', { name: 'Confirmar e enviar pedido' }).evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(review).not.toHaveClass(/open/);
  await expect(page.locator('#app-notification')).toHaveText(
    'E-mail do pedido PED-2026-000001: O provedor recusou o envio do pedido.',
  );
  await expect(page.locator('#app-notification')).toHaveClass(/e/);
  expect(createdOrders).toBe(2);
  expect(new Set(orderIdempotencyKeys).size).toBe(1);
  expect(orderIdempotencyKeys[0]).toMatch(/^order:/);
});

test('solicita exceção, recupera a aprovação e a consome em um único pedido', async ({ page }) => {
  const approvalId = 'a0000000-0000-4000-8000-000000000001';
  const versionId = '70000000-0000-4000-8000-000000000001';
  let approvalStatus: 'PENDING' | 'APPROVED' | 'CONSUMED' = 'PENDING';
  let approvalVersion = 1;
  let approvalCreated = false;
  let createdOrder: Record<string, unknown> | undefined;
  const decision = () =>
    approvalStatus === 'PENDING'
      ? null
      : {
          reviewer: {
            id: '00000000-0000-4000-8000-000000000099',
            name: 'Revisora',
            email: 'revisora@fluair.test',
          },
          note: 'Aprovado para esta negociação.',
          reviewedAt: '2026-10-01T12:00:00.000Z',
          approvedUntil: '2026-10-08T12:00:00.000Z',
        };
  const summary = () => ({
    id: approvalId,
    status: approvalStatus,
    requester: user,
    customer: {
      id: customers[0]!.id,
      code: customers[0]!.code,
      legalName: customers[0]!.legalName,
      customerClass: null,
      customerSegment: null,
    },
    requestedAt: '2026-10-01T11:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    totalQuantity: '2.0000',
    minimumTotalAmount: '20.0000',
    requestedTotalAmount: '16.0000',
    exceptionAmount: '4.0000',
    itemCount: 1,
    exceptionCount: 1,
    decision: decision(),
    consumedOrder:
      approvalStatus === 'CONSUMED'
        ? { id: '91000000-0000-4000-8000-000000000001', number: 'PED-2026-000099' }
        : null,
    version: approvalVersion,
  });
  const detail = () => ({
    ...summary(),
    justification: 'Condição comercial para fechamento.',
    consumedAt: approvalStatus === 'CONSUMED' ? '2026-10-01T13:00:00.000Z' : null,
    items: [
      {
        lineNumber: 1,
        kind: 'STANDALONE_PRODUCT',
        requiresApproval: true,
        sourceProductId: 'p-approval',
        sourceKitId: null,
        sourceCalculationVersionId: null,
        sourcePriceListVersionId: versionId,
        priceList: {
          id: 'l-approval',
          code: 'L-APP',
          name: 'Lista 1-10',
          type: 'STANDALONE_PRODUCT',
          version: 3,
          minimumOrderQuantity: 1,
          maximumOrderQuantity: 10,
        },
        calculationVersion: null,
        priceReference: 'UNIT',
        code: 'P-APP',
        description: 'Produto negociado',
        reference: 'REF-APP',
        unit: 'UN',
        quantity: '2.0000',
        referenceUnitPrice: '12.0000',
        minimumUnitPrice: '10.0000',
        negotiatedUnitPrice: '8.0000',
        minimumSubtotal: '20.0000',
        negotiatedSubtotal: '16.0000',
        exceptionUnitAmount: '2.0000',
        exceptionTotalAmount: '4.0000',
        ipiRate: '0.0000',
        icmsRate: '0.0000',
      },
    ],
  });
  const violation = {
    line: 1,
    kind: 'STANDALONE_PRODUCT',
    code: 'P-APP',
    priceListVersionId: versionId,
    priceListName: 'Lista 1-10',
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 10,
    quantity: '2.0000',
    minimumUnitPrice: '10.0000',
    negotiatedUnitPrice: '8.0000',
    unitDifference: '2.0000',
    totalDifference: '4.0000',
    differencePercentage: '20.0000',
  };

  await mockSession(page);
  await page.route('**/api/v1/customers**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customers: [customers[0]],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders/catalog**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: customers[0],
          products: [
            {
              kind: 'STANDALONE_PRODUCT',
              productId: 'p-approval',
              code: 'P-APP',
              description: 'Produto negociado',
              reference: 'REF-APP',
              unitPrice: '12.0000',
              minimumPrice: '10.0000',
              maximumPrice: '12.0000',
              priceRanges: [
                {
                  priceList: { id: 'l-approval', code: 'L-APP', name: 'Lista 1-10' },
                  priceListVersionId: versionId,
                  priceListVersion: 3,
                  minimumOrderQuantity: 1,
                  maximumOrderQuantity: 10,
                  minimumPrice: '10.0000',
                  maximumPrice: '12.0000',
                  ipiRate: '0',
                  icmsRate: '0',
                },
              ],
              ipiRate: '0',
              ipiIncluded: true,
              icmsRate: '0',
              priceListVersionId: versionId,
              priceListVersion: 3,
              priceList: { id: 'l-approval', code: 'L-APP', name: 'Lista 1-10' },
              image: null,
            },
          ],
          kits: [],
        },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 1,
          productTotalPages: 1,
          kitTotal: 0,
          kitTotalPages: 1,
        },
      }),
    }),
  );
  await page.route('**/api/v1/order-price-approvals**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/v1/order-price-approvals') {
      approvalCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { approval: summary(), violations: [violation], replayed: false },
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/mine')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: approvalCreated ? [summary()] : [],
          pagination: { page: 1, pageSize: 20, total: approvalCreated ? 1 : 0, totalPages: 1 },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: detail() }),
    });
  });
  await page.route('**/api/v1/orders/quote', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: { ...customers[0], customerClassId: null, customerSegmentId: null },
          creator: user,
          recipients: [user.email],
          quoteToken: 'new-quote-after-approval',
          expiresAt: '2026-10-01T13:10:00.000Z',
          totalQuantity: 2,
          lines: [
            {
              kind: 'STANDALONE_PRODUCT',
              productId: 'p-approval',
              productCode: 'P-APP',
              description: 'Produto negociado',
              reference: 'REF-APP',
              unit: 'UN',
              quantity: 2,
              unitPrice: '12.0000',
              referenceUnitPrice: '12.0000',
              negotiatedUnitPrice: '8.0000',
              minimumReferencePrice: '10.0000',
              normalReferencePrice: '12.0000',
              subtotal: '16.0000',
              ipiRate: '0.0000',
              ipiIncluded: true,
              icmsRate: '0.0000',
              priceList: {
                id: 'l-approval',
                code: 'L-APP',
                name: 'Lista 1-10',
                minimumOrderQuantity: 1,
                maximumOrderQuantity: 10,
              },
              priceListVersion: { id: versionId, version: 3 },
              image: null,
            },
          ],
          total: '16.0000',
          referenceTotal: '24.0000',
          approval: { required: true, violations: [violation] },
          differences: [],
          warnings: [],
          quotedAt: '2026-10-01T13:00:00.000Z',
        },
      }),
    }),
  );
  await page.route('**/api/v1/orders', async (route) => {
    createdOrder = route.request().postDataJSON() as Record<string, unknown>;
    approvalStatus = 'CONSUMED';
    approvalVersion += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          order: { id: 'o-99', number: 'PED-2026-000099', status: 'SUBMITTED' },
          emailDelivery: { id: 'e-99', status: 'PENDING', recipients: [user.email] },
          replayed: false,
        },
      }),
    });
  });
  await page.route('**/api/v1/orders/o-99', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          order: { id: 'o-99' },
          emailDeliveries: [
            {
              id: 'e-99',
              status: 'ACCEPTED',
              recipients: [user.email],
              attemptCount: 1,
              publicError: null,
              acceptedAt: '2026-10-01T13:01:00.000Z',
              deliveredAt: null,
              failedAt: null,
              bouncedAt: null,
              createdAt: '2026-10-01T13:00:00.000Z',
            },
          ],
        },
      }),
    });
  });

  await page.goto('/pedidos/novo');
  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: /Expresso Figueiredo/ }).click();
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();
  await page.getByRole('button', { name: /Adicionar P-APP por R\$\s*12,00/ }).click();
  await page.locator('#order-drawer').getByRole('button', { name: 'Fechar' }).click();
  await page.getByLabel('Quantidade de P-APP').fill('2');
  await page.getByLabel('Quantidade de P-APP').press('Tab');
  await page.getByLabel('Preço unitário de P-APP').fill('8,00');
  await page.getByLabel('Preço unitário de P-APP').press('Tab');
  await page.getByRole('button', { name: 'Solicitar aprovação' }).click();
  const requestDialog = page.getByRole('dialog', { name: 'Solicitar aprovação de preço' });
  await expect(requestDialog).toContainText('Impacto total abaixo do mínimo: R$ 4,00');
  await requestDialog
    .getByLabel('Justificativa obrigatória')
    .fill('Condição comercial para fechamento.');
  await requestDialog.getByRole('button', { name: 'Enviar solicitação' }).click();
  await expect(page.getByRole('button', { name: 'Aguardando aprovação' })).toBeDisabled();
  await expect(page.locator('#order-approvals-list')).toContainText('Pendente');

  approvalStatus = 'APPROVED';
  approvalVersion += 1;
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await expect(page.getByRole('button', { name: 'Gerar pedido', exact: true })).toBeEnabled();
  await expect(page.locator('#order-approvals-list')).toContainText('Revisora');
  await page.getByRole('button', { name: 'Gerar pedido', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Revisar e confirmar pedido' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Confirmar e enviar pedido' }).click();
  await expect(page.locator('#order-review-modal')).not.toHaveClass(/open/);
  await expect(page.locator('#app-notification')).toHaveText(
    'E-mail do pedido PED-2026-000099 aceito pelo provedor.',
  );
  await expect(page.locator('#app-notification')).toHaveClass(/s/);
  expect(createdOrder?.approvalRequestId).toBe(approvalId);
});
