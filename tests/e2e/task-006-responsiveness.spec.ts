import { expect, test, type Page, type Route } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertElementsDoNotOverlap,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
  captureResponsiveScreenshot,
} from './helpers/responsive-layout.js';

const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora responsiva com nome operacional extenso',
  email: 'admin.responsiva@fluair.test',
  roleCode: 'ADMINISTRATOR',
  permissions: [
    'order.access',
    'price.view',
    'price.override',
    'customer.view',
    'customer.manage',
    'order.price-approval.manage',
  ],
};

const customer = {
  id: '10000000-0000-4000-8000-000000000001',
  code: 'CLIENTE-CODIGO-EXTENSO-0001',
  legalName: 'Cliente Industrial com Razao Social Excepcionalmente Longa Ltda.',
  cnpj: '12345678000190',
  city: 'Sao Paulo',
  state: 'SP',
  segment: 'Industrial de grande porte e operacao nacional',
  customerClass: null,
  customerSegment: null,
  seller: 'Vendedora com nome operacional muito longo',
  representative: 'Representante comercial com nome muito longo',
  internalNote: null,
  orderNote: 'Entregar no periodo combinado e confirmar o recebimento com antecedencia.',
  active: true,
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

const image = {
  id: 'image-responsive',
  thumbnailUrl: '/api/v1/media/image-responsive/thumb',
  displayUrl: '/api/v1/media/image-responsive/display',
  width: 1200,
  height: 800,
  updatedAt: '2026-10-18T12:00:00.000Z',
};

const product = {
  kind: 'STANDALONE_PRODUCT',
  productId: '20000000-0000-4000-8000-000000000001',
  code: 'PRODUTO-CODIGO-MUITO-LONGO-0001',
  description: 'Produto avulso com descricao comercial longa para validar o drawer',
  reference: 'REFERENCIA-SEM-ESPACOS-0000000000001',
  unitPrice: '1234567.89',
  minimumPrice: '1200000.00',
  maximumPrice: '1234567.89',
  priceRanges: [
    {
      priceList: {
        id: '30000000-0000-4000-8000-000000000001',
        code: 'FAIXA-RESP',
        name: 'Lista comercial com nome muito longo',
      },
      priceListVersionId: '40000000-0000-4000-8000-000000000001',
      priceListVersion: 8,
      minimumOrderQuantity: 1,
      maximumOrderQuantity: 99,
      minimumPrice: '1200000.00',
      maximumPrice: '1234567.89',
      pisRate: '1.65',
      cofinsRate: '7.60',
      icmsRate: '18.00',
      ipiRate: '12.50',
    },
  ],
  pisRate: '1.65',
  cofinsRate: '7.60',
  icmsRate: '18.00',
  ipiRate: '12.50',
  ipiIncluded: false,
  priceListVersionId: '40000000-0000-4000-8000-000000000001',
  priceListVersion: 8,
  priceList: {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'FAIXA-RESP',
    name: 'Lista comercial com nome muito longo',
  },
  image,
};

const kit = {
  kind: 'KIT',
  calculationId: '50000000-0000-4000-8000-000000000001',
  calculationVersion: 12,
  code: 'KIT-CODIGO-MUITO-LONGO-0001',
  description: 'Kit completo com descricao excepcionalmente longa para o pedido responsivo',
  reference: 'KIT-REFERENCIA-EXTENSA-0001',
  minimumPrice: '2345678.90',
  normalPrice: '3456789.01',
  pisRate: '1.65',
  cofinsRate: '7.60',
  icmsRate: '18.00',
  ipiRate: '12.50',
  scope: 'STANDARD',
  calculatedAt: '2026-10-18T12:00:00.000Z',
  priceList: {
    id: '60000000-0000-4000-8000-000000000001',
    code: 'KITS-RESP',
    name: 'Lista de kits responsivos',
    type: 'KIT_COMPONENT',
  },
  priceListVersion: { id: '70000000-0000-4000-8000-000000000001', version: 12 },
  image,
};

const requester = {
  id: '80000000-0000-4000-8000-000000000001',
  name: 'Solicitante com nome comercial excepcionalmente longo',
  email: 'solicitante.comercial.extenso@fluair.test',
};

const approval = {
  id: '90000000-0000-4000-8000-000000000001',
  status: 'PENDING',
  requester,
  customer: {
    id: customer.id,
    code: customer.code,
    legalName: customer.legalName,
    customerClass: null,
    customerSegment: null,
  },
  requestedAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
  totalQuantity: '99999.0000',
  minimumTotalAmount: '123456789.1200',
  requestedTotalAmount: '98765432.1000',
  exceptionAmount: '24691357.0200',
  itemCount: 12,
  exceptionCount: 2,
  waitingSeconds: 3600,
  decision: null,
  consumedOrder: null,
  version: 1,
};

const approvalItem = {
  lineNumber: 1,
  kind: 'STANDALONE_PRODUCT',
  requiresApproval: true,
  sourceProductId: product.productId,
  sourceKitId: null,
  sourceCalculationVersionId: null,
  sourcePriceListVersionId: product.priceListVersionId,
  priceList: {
    id: product.priceList.id,
    code: product.priceList.code,
    name: product.priceList.name,
    type: 'STANDALONE_PRODUCT',
    version: 8,
    minimumOrderQuantity: 1,
    maximumOrderQuantity: 99,
  },
  calculationVersion: null,
  priceReference: 'UNIT',
  code: product.code,
  description: product.description,
  reference: product.reference,
  unit: 'UN',
  quantity: '99999.0000',
  referenceUnitPrice: '1234567.8900',
  minimumUnitPrice: '1200000.0000',
  negotiatedUnitPrice: '999999.9900',
  finalUnitPrice: '1399749.9800',
  minimumSubtotal: '119998800000.0000',
  negotiatedSubtotal: '99998999000.0100',
  exceptionUnitAmount: '200000.0100',
  exceptionTotalAmount: '19999800999.9900',
  taxes: {
    pis: { selected: true, rate: '1.65', unitAmount: '16499.99' },
    cofins: { selected: true, rate: '7.60', unitAmount: '75999.99' },
    icms: { selected: true, rate: '18.00', unitAmount: '179999.99' },
    ipi: { selected: true, rate: '12.50', unitAmount: '124999.99' },
    totalUnitAmount: '397499.99',
  },
};

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
}

function quoteLine(source: typeof product | typeof kit) {
  const isKit = source.kind === 'KIT';
  return {
    kind: source.kind,
    ...(isKit
      ? { calculationId: kit.calculationId, calculationVersion: kit.calculationVersion }
      : { productCode: product.code }),
    code: source.code,
    description: source.description,
    reference: source.reference,
    priceReference: isKit ? 'NORMAL' : 'UNIT',
    quantity: 99999,
    unitPrice: isKit ? kit.normalPrice : product.unitPrice,
    referenceUnitPrice: isKit ? kit.normalPrice : product.unitPrice,
    negotiatedUnitPrice: isKit ? kit.normalPrice : product.unitPrice,
    minimumReferencePrice: isKit ? kit.minimumPrice : product.minimumPrice,
    normalReferencePrice: isKit ? kit.normalPrice : product.maximumPrice,
    finalUnitPrice: '4567890.12',
    subtotal: '456784444209.88',
    taxes: {
      pis: { selected: true, rate: '1.65', unitAmount: '1' },
      cofins: { selected: true, rate: '7.60', unitAmount: '1' },
      icms: { selected: true, rate: '18.00', unitAmount: '1' },
      ipi: { selected: true, rate: '12.50', unitAmount: '1' },
      totalUnitAmount: '4',
    },
    priceList: isKit ? kit.priceList : product.priceList,
    priceListVersion: isKit
      ? kit.priceListVersion
      : { id: product.priceListVersionId, version: product.priceListVersion },
    image,
  };
}

async function mockApplication(page: Page): Promise<void> {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === '/api/v1/auth/me')
      return json(route, {
        data: { user: admin, session: { expiresAt: '2027-01-01T00:00:00.000Z' } },
      });
    if (pathname.startsWith('/api/v1/media/'))
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    if (pathname.startsWith('/api/v1/orders/draft')) {
      const drafts = Array.from({ length: 5 }, (_, index) => ({
        id: `d0000000-0000-4000-8000-00000000000${index}`,
        revision: 1,
        customer: {
          id: `10000000-0000-4000-8000-00000000000${index + 2}`,
          code: `CLIENTE-RASCUNHO-${index + 1}`,
          legalName: `Cliente com nome de rascunho excepcionalmente longo numero ${index + 1}`,
          active: true,
        },
        payload: { cart: [], note: '' },
        updatedAt: `2026-10-18T1${index}:00:00.000Z`,
      }));
      if (pathname.endsWith('/swap'))
        return json(route, { data: { restored: null, drafts, evicted: null } });
      if (request.method() === 'PUT') return json(route, { data: { draft: drafts[0], drafts } });
      return json(route, { data: { drafts } });
    }
    if (pathname === '/api/v1/customers')
      return json(route, {
        data: {
          customers: [customer],
          filters: { segments: [], sellers: [], representatives: [] },
          pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
        },
      });
    if (pathname === `/api/v1/customers/${customer.id}`) return json(route, { data: { customer } });
    if (pathname === '/api/v1/orders/price-lists')
      return json(route, { data: { customer, totalQuantity: 0, priceLists: [] } });
    if (pathname === '/api/v1/orders/catalog')
      return json(route, {
        data: { customer, products: [product], calculatedProducts: [], kits: [kit] },
        pagination: {
          page: 1,
          pageSize: 12,
          productTotal: 1,
          productTotalPages: 1,
          calculatedProductTotal: 0,
          kitTotal: 1,
          kitTotalPages: 1,
        },
      });
    if (pathname === '/api/v1/orders/saved-catalog')
      return json(route, {
        data: { calculatedProducts: [], kits: [] },
        pagination: {
          page: 1,
          pageSize: 12,
          calculatedProductTotal: 0,
          calculatedProductTotalPages: 1,
          kitTotal: 0,
        },
      });
    if (pathname === '/api/v1/orders/last-sale-prices') {
      const input = request.postDataJSON() as { lines?: Array<{ key: string }> };
      return json(route, {
        data: { prices: (input.lines ?? []).map(({ key }) => ({ key, lastOrderPrice: null })) },
      });
    }
    if (pathname === '/api/v1/orders/quote')
      return json(route, {
        data: {
          customer,
          creator: admin,
          recipients: [admin.email],
          quoteToken: 'quote-token-responsive',
          expiresAt: '2026-10-18T13:00:00.000Z',
          differences: [],
          totalQuantity: 199998,
          lines: [quoteLine(product), quoteLine(kit)],
          total: '913568888419.76',
          referenceTotal: '913568888419.76',
          warnings: ['Aviso extenso preservado durante a revisao do pedido.'],
          quotedAt: '2026-10-18T12:00:00.000Z',
        },
      });
    if (pathname === '/api/v1/order-price-approvals/admin/count')
      return json(route, { data: { pending: 1 } });
    if (pathname === `/api/v1/order-price-approvals/admin/${approval.id}`)
      return json(route, {
        data: {
          ...approval,
          justification:
            'Justificativa comercial longa, preservada integralmente para uma decisao responsavel.',
          items: [approvalItem, { ...approvalItem, lineNumber: 2, code: kit.code }],
          consumedAt: null,
        },
      });
    if (pathname.startsWith('/api/v1/order-price-approvals/admin'))
      return json(route, {
        data: [approval],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    return json(route, { data: {} });
  });
}

test.beforeEach(async ({ page }) => mockApplication(page));

test('Pedido mantém rascunhos, drawer e carrinho misto operáveis', async ({ page }, testInfo) => {
  await page.goto('/pedidos/novo');
  await expect(page.locator('.order-draft-tab-wrap')).toHaveCount(5);
  await assertNoDocumentHorizontalOverflow(page);

  const draftDimensions = await page.locator('.order-draft-tabs').evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  if ((page.viewportSize()?.width ?? 0) <= 480)
    expect(draftDimensions.scroll).toBeGreaterThan(draftDimensions.client);

  await page.locator('#pedido-client-trigger').click();
  await page.getByRole('option', { name: new RegExp(customer.legalName) }).click();
  await page.getByRole('button', { name: 'Adicionar mais itens' }).click();

  const drawer = page.locator('#order-drawer');
  await expect(drawer).toHaveClass(/open/);
  await assertElementWithinViewport(drawer.locator('#order-drawer-close'));
  await assertMinimumInteractiveArea(drawer.locator('#order-drawer-close'));
  await assertNoDocumentHorizontalOverflow(page);
  if ((page.viewportSize()?.width ?? 0) <= 700) {
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }

  await drawer
    .getByRole('button', { name: `Adicionar ${product.code} ao pedido`, exact: true })
    .click();
  await drawer
    .getByRole('button', { name: `Adicionar ${kit.code} ao pedido`, exact: true })
    .click();
  await drawer.locator('#order-drawer-close').click();

  const rows = page.locator('.order-cart-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(product.reference);
  await expect(rows.last()).toContainText(kit.reference);
  await assertNoDocumentHorizontalOverflow(page);
  await assertElementsDoNotOverlap(
    rows.first().getByLabel(new RegExp(`Quantidade de ${product.code}`)),
    rows.first().getByLabel(new RegExp(`Preço unitário de ${product.code}`)),
  );
  await assertElementsDoNotOverlap(
    rows.first().locator('.order-cart-tax-field'),
    rows.first().locator('.order-cart-subtotal'),
  );
  const subtotalFits = await rows
    .first()
    .locator('.order-cart-subtotal')
    .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(subtotalFits).toBe(true);
  await assertMinimumInteractiveArea(rows.first().locator('.order-cart-tax-option').first());

  await rows
    .first()
    .getByLabel(new RegExp(`Quantidade de ${product.code}`))
    .fill('99999');
  await rows
    .first()
    .getByLabel(new RegExp(`Preço unitário de ${product.code}`))
    .fill('1234567,89');
  await page
    .locator('#pedidoObs')
    .fill('Observação longa preenchida com viewport reduzida para simular um teclado virtual.');
  await page.locator('#pedidoObs').focus();
  await assertElementWithinViewport(page.locator('#pedidoObs'));
  await page.locator('#order-review').click();

  const review = page.locator('#order-review-modal');
  await expect(review).toHaveClass(/open/);
  await expect(review).toContainText(product.code);
  await expect(review).toContainText(kit.code);
  await expect(review).toContainText('R$ 913.568.888.419,76');
  await assertElementWithinViewport(review.locator('#order-review-close'));
  await assertElementWithinViewport(review.locator('#order-review-back'));
  await assertElementWithinViewport(review.locator('#order-confirm'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/pedidos/novo',
    state: 'revisao-carrinho-misto',
  });
});

test('Aprovações preserva filtros, cartões, detalhe e decisão', async ({ page }, testInfo) => {
  await page.goto('/aprovacoes/precos');
  await expect(page.locator('#admin-approvals-body tr')).toHaveCount(1);
  await expect(page.locator('#admin-approvals-body')).toContainText(customer.legalName);
  await expect(page.locator('#admin-approvals-body')).toContainText(requester.email);
  await assertNoDocumentHorizontalOverflow(page);
  await assertElementWithinViewport(page.locator('#admin-approvals-clear'));

  if ((page.viewportSize()?.width ?? 0) <= 700) {
    const filterColumns = await page
      .locator('.approval-filters')
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(filterColumns).toBe(1);
  }

  await page.getByRole('button', { name: 'Analisar' }).click();
  const detail = page.locator('#admin-approval-detail-modal');
  await expect(detail).toHaveClass(/open/);
  await expect(detail).toContainText('Justificativa comercial longa');
  await expect(detail.locator('.approval-item')).toHaveCount(2);
  await assertElementWithinViewport(detail.locator('#admin-approval-detail-close'));
  await assertElementWithinViewport(detail.locator('#admin-approval-detail-done'));
  await assertElementWithinViewport(detail.locator('#admin-approval-reject'));
  await assertElementWithinViewport(detail.locator('#admin-approval-approve'));
  await assertNoDocumentHorizontalOverflow(page);

  await detail.locator('#admin-approval-reject').click();
  const decision = page.locator('#admin-approval-decision-modal');
  await expect(decision).toHaveClass(/open/);
  await decision
    .locator('#admin-decision-note')
    .fill('Motivo detalhado da reprovação, editado com altura útil reduzida.');
  await assertElementWithinViewport(decision.locator('#admin-decision-close'));
  await assertElementWithinViewport(decision.locator('#admin-decision-cancel'));
  await assertElementWithinViewport(decision.locator('#admin-decision-submit'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/aprovacoes/precos',
    state: 'decisao-aberta',
  });
});

test('Painel de notificações permanece alcançável sem cobrir ações', async ({ page }, testInfo) => {
  await page.goto('/aprovacoes/precos');
  if ((page.viewportSize()?.width ?? 0) <= 1024)
    await page.getByRole('button', { name: 'Menu' }).click();

  const button = page.locator('#admin-approvals-notification-button');
  await expect(button).toHaveAttribute('aria-label', /1 pendência/);
  await button.click();
  const panel = page.locator('#admin-approvals-notification-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(customer.legalName);
  await assertElementWithinViewport(panel);
  await assertElementWithinViewport(panel.locator('#admin-approvals-notification-close'));
  await assertElementWithinViewport(panel.locator('#admin-approvals-nav-link'));
  await assertNoDocumentHorizontalOverflow(page);
  await captureResponsiveScreenshot(page, testInfo, {
    route: '/aprovacoes/precos',
    state: 'notificacoes-abertas',
  });
});
