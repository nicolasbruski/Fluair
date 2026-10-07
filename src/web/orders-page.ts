import { ROLE_CODES, type AuthenticatedUser } from '../shared/auth.js';
import type { Customer, CustomerClass, CustomerSegment } from '../shared/customers.js';
import type { LastOrderPrice } from '../shared/last-order-price.js';
import type { CalculationDetail } from '../shared/pricing.js';
import type {
  EligibleOrderPriceList,
  OrderDraft,
  OrderDraftCartItem,
  OrderKitCatalogItem,
  OrderQuoteEnvelope,
  OrderStandaloneCatalogItem,
} from '../shared/orders.js';
import type {
  MyOrderPriceApprovalDetail,
  MyOrderPriceApprovalSummary,
  OrderPriceViolation,
} from '../shared/order-price-approvals.js';
import { orderTotalQuantity } from '../shared/order-quantity.js';
import {
  orderAmount,
  orderLineAmount,
  orderTaxUnitAmount,
  orderUnitAmount,
} from '../shared/order-money.js';
import { descriptionWithoutUser } from './display-text.js';
import { customerDraftLabel } from './order-draft-tabs.js';
import { createMediaImage } from './components/media-image.js';
import { showNotification } from './notifications.js';
import { emailDeliveryNotification } from './order-email-status.js';
import { ApiError } from './services/api.js';
import { getCalculation } from './services/calculations-api.js';
import {
  getCustomer,
  listCustomerClassifications,
  listCustomers,
  preRegisterCustomer,
} from './services/customers-api.js';
import {
  createOrder,
  listEligibleOrderPriceLists,
  loadOrder,
  loadOrderCatalog,
  loadSavedOrderCatalog,
  loadOrderDraft,
  loadLastSalePrices,
  quoteOrder,
  saveOrderDraft,
  swapOrderDraft,
  deleteOrderDraft,
} from './services/orders-api.js';
import {
  createOrderPriceApproval,
  getMyOrderPriceApproval,
} from './services/order-price-approvals-api.js';

type CatalogItem = OrderStandaloneCatalogItem | OrderKitCatalogItem;

type CartItem = OrderDraftCartItem;

function defaultTaxes(rates: Partial<Record<'pis' | 'cofins' | 'icms' | 'ipi', number>> = {}) {
  return {
    pis: { selected: true, rate: rates.pis ?? 0 },
    cofins: { selected: true, rate: rates.cofins ?? 0 },
    icms: { selected: true, rate: rates.icms ?? 0 },
    ipi: { selected: true, rate: rates.ipi ?? 0 },
  };
}

function ensureTaxes(item: CartItem): NonNullable<CartItem['taxes']> {
  item.taxes ??= defaultTaxes({
    pis: item.pisRate ?? 0,
    cofins: item.cofinsRate ?? 0,
    icms: item.icmsRate ?? 0,
    ipi: item.ipiRate ?? item.taxRate ?? 0,
  });
  return item.taxes;
}

let currentUser: AuthenticatedUser | null = null;
let customers: Customer[] = [];
let customerClasses: CustomerClass[] = [];
let customerSegments: CustomerSegment[] = [];
let selectedCustomer: Customer | null = null;
// Mantidos apenas para compatibilidade temporária com o painel legado de listas.
// O catálogo novo agrega todas as listas permitidas e não exige seleção manual.
let priceLists: EligibleOrderPriceList[] = [];
let selectedPriceList: EligibleOrderPriceList | null = null;
let cart: CartItem[] = [];
let savedDrafts: OrderDraft[] = [];
let customerSwitching = false;
let draftSequence = 0;
let draftSaveTimer: number | undefined;
let draftSaveSequence = 0;
let draftSaveInFlight: Promise<void> | null = null;
let orderContextSequence = 0;
let customerTimer: number | undefined;
let catalogTimer: number | undefined;
let customerSequence = 0;
let priceListSequence = 0;
let catalogSequence = 0;
let lastSalePriceSequence = 0;
let lastSalePricesFailed = false;
let drawerLastSalePriceSequence = 0;
let drawerLastSalePrices = new Map<string, LastOrderPrice | null>();
let drawerLastSalePricesFailed = false;
let catalogPage = 1;
let catalogPages = 1;
let initialized = false;
let pendingCalculation: CalculationDetail | null = null;
let visibleCatalogItems: CatalogItem[] = [];
let drawerFilter: 'ALL' | 'KIT' | 'VALVE' | 'ITEM' = 'ALL';
let activeReview: {
  quote: OrderQuoteEnvelope['data'];
  fingerprint: string;
  idempotencyKey: string;
} | null = null;
let reviewSubmitting = false;
let reviewFocusReturn: HTMLElement | null = null;
let approvalSubmitting = false;
let approvalFocusReturn: HTMLElement | null = null;
let quotedViolations: OrderPriceViolation[] = [];
let approvalAttempt: { fingerprint: string; idempotencyKey: string } | null = null;
let selectedApproval: MyOrderPriceApprovalDetail | null = null;
let supersededApprovalId: string | null = null;
const monitoredEmailDeliveries = new Set<string>();
const emailDeliveryPollIntervalMs = 2_000;
const emailDeliveryMonitorTimeoutMs = 2 * 60_000;

type OrderReturnDestination = {
  href: string;
  screen: 'detalhe' | 'clientes';
};

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}
function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove();
}
function canViewCustomers(): boolean {
  return Boolean(
    currentUser?.permissions.some(
      (permission) => permission === 'customer.view' || permission === 'customer.manage',
    ),
  );
}
function canManageCustomers(): boolean {
  return currentUser?.roleCode === ROLE_CODES.administrator;
}
function canViewPrices(): boolean {
  return Boolean(currentUser?.permissions.includes('price.view'));
}
function canOverridePrices(): boolean {
  return Boolean(currentUser?.permissions.includes('price.override'));
}
function customerDetails(customer: Customer): string {
  const cnpj = customer.cnpj
    ? customer.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : '---';
  const location = [customer.city, customer.state].filter(Boolean).join('/') || '---';
  return `CNPJ: ${cnpj} · Cidade/Estado: ${location}`;
}
function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
function state(message: string): HTMLDivElement {
  const node = document.createElement('div');
  node.className = 'order-state';
  node.textContent = message;
  return node;
}
function totalQuantity(): number {
  return orderTotalQuantity(cart);
}

function orderReturnDestination(): OrderReturnDestination | null {
  const requested = new URLSearchParams(window.location.search).get('returnTo');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return null;
  const navigationState = window.history.state as { orderOrigin?: unknown } | null;
  if (navigationState?.orderOrigin !== requested) return null;
  const url = new URL(requested, window.location.origin);
  if (/^\/calculos\/[0-9a-f-]{36}$/i.test(url.pathname)) {
    return { href: `${url.pathname}${url.search}${url.hash}`, screen: 'detalhe' };
  }
  if (url.pathname === '/clientes' && url.searchParams.get('cliente')) {
    return { href: `${url.pathname}${url.search}${url.hash}`, screen: 'clientes' };
  }
  return null;
}

function syncBackButton(): void {
  element<HTMLButtonElement>('#order-back').hidden = !orderReturnDestination();
}

function backToOrderOrigin(): void {
  const destination = orderReturnDestination();
  if (!destination) return;
  window.history.pushState(null, '', destination.href);
  window.show(destination.screen);
}

function calculationCartItem(detail: CalculationDetail): CartItem {
  return {
    key: `kit:${detail.id}:NORMAL`,
    kind: 'KIT',
    code: detail.kitCode,
    description: descriptionWithoutUser(detail.kitDescription),
    price: Number(detail.normalTotal),
    taxRate: Number(detail.ipiRate ?? 0),
    taxes: defaultTaxes({
      pis: Number(detail.pisRate ?? 0),
      cofins: Number(detail.cofinsRate ?? 0),
      icms: Number(detail.icmsRate ?? 0),
      ipi: Number(detail.ipiRate ?? 0),
    }),
    referencePrice: Number(detail.normalTotal),
    priceEdited: false,
    priceReference: 'NORMAL',
    source: `${detail.priceList.name} · cálculo v${detail.version} · lista v${detail.priceListVersion.version}`,
    sourceVersionId: detail.priceListVersion.id,
    calculatedAt: detail.createdAt,
    minimumPrice: Number(detail.minimumTotal),
    normalPrice: Number(detail.normalTotal),
    pisRate: Number(detail.pisRate ?? 0),
    cofinsRate: Number(detail.cofinsRate ?? 0),
    icmsRate: Number(detail.icmsRate ?? 0),
    ipiRate: Number(detail.ipiRate ?? 0),
    calculationId: detail.id,
    quantity: 1,
    image: detail.image,
  };
}

function applyPendingCalculation(): void {
  if (!pendingCalculation) return;
  cart = [calculationCartItem(pendingCalculation)];
}

async function loadPendingCalculation(id: string): Promise<void> {
  try {
    const detail = (await getCalculation(id)).data.calculation;
    if (!detail.current) throw new Error('Somente a versão atual pode ser adicionada ao pedido.');
    pendingCalculation = detail;
    applyPendingCalculation();
    renderCart();
    void refreshLastSalePrices();
    if (selectedCustomer) void loadCatalog();
  } catch (error) {
    pendingCalculation = null;
    setRangeWarning(apiMessage(error, 'Não foi possível adicionar o kit ao pedido.'));
  }
}

async function loadPendingCustomer(id: string): Promise<boolean> {
  try {
    const customer = (await getCustomer(id)).data.customer;
    if (!customer.active) throw new Error('O cliente selecionado está desativado.');
    await selectCustomer(customer);
    return selectedCustomer?.id === customer.id;
  } catch (error) {
    setRangeWarning(apiMessage(error, 'Não foi possível adicionar o cliente ao pedido.'));
    return false;
  }
}

async function loadOrderContext(
  calculationId: string | null,
  customerId: string | null,
): Promise<void> {
  const sequence = ++orderContextSequence;
  if (customerId && selectedCustomer?.id !== customerId) {
    const changed = await loadPendingCustomer(customerId);
    if (sequence !== orderContextSequence) return;
    if (!changed) return;
  }
  if (calculationId) {
    if (pendingCalculation?.id !== calculationId) {
      cart = [];
      selectedPriceList = null;
      renderCart();
      await loadPendingCalculation(calculationId);
    } else {
      applyPendingCalculation();
      renderCart();
    }
  } else {
    pendingCalculation = null;
  }
}

function lineQuantities(): number[] {
  return cart.map(({ quantity }) => quantity);
}

function setRangeWarning(message = ''): void {
  const warning = element<HTMLElement>('#order-range-warning');
  warning.textContent = message;
  warning.hidden = !message;
}
function setQuoteFeedback(message = '', error = false): void {
  const feedback = element<HTMLElement>('#order-quote-feedback');
  feedback.textContent = message;
  feedback.hidden = !message;
  feedback.classList.toggle('error', error);
}
function invalidateQuote(): void {
  setQuoteFeedback();
  quotedViolations = [];
  approvalAttempt = null;
  if (selectedApproval?.status === 'PENDING') supersededApprovalId = selectedApproval.id;
  selectedApproval = null;
  window.sessionStorage.removeItem('order-price-approval-id');
  if (activeReview && !reviewSubmitting) closeOrderReview(false);
}
function money(value: number | string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function percentage(value: number | string): string {
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
}

function date(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

function orderInput() {
  if (!selectedCustomer) return null;
  return {
    customerId: selectedCustomer.id,
    lines: cart.map((item) =>
      item.kind === 'STANDALONE_PRODUCT'
        ? {
            kind: item.kind,
            productCode: item.code,
            priceListVersionId: item.sourceVersionId,
            quantity: item.quantity,
            negotiatedUnitPrice: item.price.toFixed(4),
            appliedTaxes: {
              pis: ensureTaxes(item).pis.selected,
              cofins: ensureTaxes(item).cofins.selected,
              icms: ensureTaxes(item).icms.selected,
              ipi: ensureTaxes(item).ipi.selected,
            },
          }
        : {
            kind: item.kind,
            calculationId: item.calculationId!,
            priceReference: item.priceReference as 'MINIMUM' | 'NORMAL',
            quantity: item.quantity,
            negotiatedUnitPrice: item.price.toFixed(4),
            appliedTaxes: {
              pis: ensureTaxes(item).pis.selected,
              cofins: ensureTaxes(item).cofins.selected,
              icms: ensureTaxes(item).icms.selected,
              ipi: ensureTaxes(item).ipi.selected,
            },
          },
    ),
  };
}

function reviewFingerprint(): string {
  return JSON.stringify({
    input: orderInput(),
    note: element<HTMLTextAreaElement>('#pedidoObs').value,
    taxes: cart.map((item) => ({ key: item.key, taxes: item.taxes ?? null })),
  });
}

function newIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const random = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `order:${Date.now().toString(36)}:${random}`;
}

function approvalStatusMessage(approval: MyOrderPriceApprovalSummary): string {
  const review = approval.decision
    ? ` Revisada por ${approval.decision.reviewer.name} em ${new Date(approval.decision.reviewedAt).toLocaleString('pt-BR')}.`
    : '';
  if (approval.status === 'REJECTED')
    return approval.decision?.note
      ? `Motivo: ${approval.decision.note}.${review}`
      : `A solicitação foi reprovada.${review}`;
  if (approval.status === 'APPROVED')
    return `Válida até ${approval.decision?.approvedUntil ? new Date(approval.decision.approvedUntil).toLocaleString('pt-BR') : 'a data informada pelo servidor'}.${review}`;
  if (approval.status === 'CONSUMED')
    return approval.consumedOrder
      ? `Consumida no pedido ${approval.consumedOrder.number}.`
      : 'A aprovação já foi consumida.';
  if (approval.status === 'PENDING') return 'Aguardando análise. Nenhum pedido foi criado.';
  if (approval.status === 'EXPIRED') return 'A validade terminou. Faça uma nova solicitação.';
  if (approval.status === 'SUPERSEDED') return 'Esta solicitação foi substituída por outra.';
  return 'Esta solicitação foi cancelada.';
}

function createOrderReviewModal(): void {
  if (document.querySelector('#order-review-modal')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'order-review-modal';
  overlay.innerHTML = `<div class="modal order-review-dialog" role="dialog" aria-modal="true" aria-labelledby="order-review-title" aria-describedby="order-review-status"><div class="modal-header"><div class="modal-title" id="order-review-title">Revisar e confirmar pedido</div><button class="modal-close" id="order-review-close" type="button" aria-label="Fechar revisão">×</button></div><div class="order-review-body" id="order-review-content"></div><div id="order-review-status" class="order-state order-review-error" role="status" aria-live="assertive" hidden></div><div class="modal-footer" id="order-review-actions"><button class="btn btn-ghost" id="order-review-back" type="button">Voltar e revisar</button><button class="btn btn-primary" id="order-confirm" type="button">Confirmar e enviar pedido</button></div></div>`;
  document.body.append(overlay);
}

function createApprovalModal(): void {
  if (document.querySelector('#order-approval-modal')) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'order-approval-modal';
  overlay.innerHTML = `<div class="modal order-approval-dialog" role="dialog" aria-modal="true" aria-labelledby="order-approval-title" aria-describedby="order-approval-status"><div class="modal-header"><div class="modal-title" id="order-approval-title">Solicitar aprovação de preço</div><button class="modal-close" id="order-approval-close" type="button" aria-label="Fechar solicitação">×</button></div><div class="order-approval-body" id="order-approval-content"></div><div class="fld"><label class="lbl" for="order-approval-justification">Justificativa obrigatória</label><textarea class="inp order-approval-justification" id="order-approval-justification" minlength="10" maxlength="2000" placeholder="Explique o motivo comercial da exceção."></textarea></div><div id="order-approval-status" class="order-state order-review-error" role="alert" aria-live="assertive" hidden></div><div class="modal-footer"><button class="btn btn-ghost" id="order-approval-cancel" type="button">Cancelar</button><button class="btn btn-primary" id="order-approval-submit" type="button">Enviar solicitação</button></div></div>`;
  document.body.append(overlay);
}

function renderApprovalRequest(): void {
  const content = element<HTMLElement>('#order-approval-content');
  clear(content);
  const summary = document.createElement('div');
  summary.className = 'order-review-summary';
  summary.append(
    reviewTextCard(
      'Cliente',
      selectedCustomer ? `${selectedCustomer.code} · ${selectedCustomer.legalName}` : '---',
    ),
    reviewTextCard('Carrinho', `${totalQuantity()} itens · ${money(orderAmount(cart))}`),
    reviewTextCard('Linhas em exceção', String(quotedViolations.length)),
  );
  const impact = quotedViolations.reduce(
    (total, violation) => total + Number(violation.totalDifference),
    0,
  );
  const warning = document.createElement('p');
  warning.className = 'order-approval-impact';
  warning.textContent = `Impacto total abaixo do mínimo: ${money(impact)}. A solicitação não cria um pedido.`;
  const items = document.createElement('div');
  items.className = 'order-review-items';
  for (const violation of quotedViolations) {
    const row = document.createElement('div');
    row.className = 'order-review-item is-exception';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = `${violation.code} · linha ${violation.line}`;
    const meta = document.createElement('div');
    meta.className = 'order-review-item-meta';
    meta.textContent = `${violation.priceListName} · faixa ${compactRangeLabel(violation.minimumOrderQuantity, violation.maximumOrderQuantity, '')} · versão ${violation.priceListVersionId}`;
    copy.append(title, meta);
    const values = document.createElement('div');
    values.className = 'order-review-item-values';
    values.textContent = `Mínimo ${money(violation.minimumUnitPrice)} · solicitado ${money(violation.negotiatedUnitPrice)}`;
    const difference = document.createElement('div');
    difference.textContent = `Diferença ${money(violation.unitDifference)} por unidade · ${money(violation.totalDifference)} no total · ${percentage(violation.differencePercentage)}`;
    values.append(difference);
    row.append(copy, values);
    items.append(row);
  }
  content.append(summary, warning, items);
}

function setApprovalStatus(message = '', error = false): void {
  const status = element<HTMLElement>('#order-approval-status');
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('error', error);
}

function closeApprovalModal(restoreFocus = true, force = false): void {
  if (approvalSubmitting && !force) return;
  element<HTMLElement>('#order-approval-modal').classList.remove('open');
  setApprovalStatus();
  if (restoreFocus) approvalFocusReturn?.focus();
}

function openApprovalModal(): void {
  approvalFocusReturn =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderApprovalRequest();
  setApprovalStatus();
  const modal = element<HTMLElement>('#order-approval-modal');
  modal.classList.add('open');
  window.requestAnimationFrame(() =>
    element<HTMLTextAreaElement>('#order-approval-justification').focus(),
  );
}

async function submitApprovalRequest(): Promise<void> {
  if (approvalSubmitting || !selectedCustomer || !quotedViolations.length) return;
  const input = orderInput();
  if (!input) return;
  const justification = element<HTMLTextAreaElement>('#order-approval-justification').value.trim();
  if (justification.length < 10) {
    setApprovalStatus('Informe uma justificativa com pelo menos 10 caracteres.', true);
    return;
  }
  const fingerprint = JSON.stringify(input);
  if (!approvalAttempt || approvalAttempt.fingerprint !== fingerprint) {
    approvalAttempt = { fingerprint, idempotencyKey: newIdempotencyKey() };
  }
  const submit = element<HTMLButtonElement>('#order-approval-submit');
  const cancel = element<HTMLButtonElement>('#order-approval-cancel');
  approvalSubmitting = true;
  submit.disabled = true;
  cancel.disabled = true;
  submit.textContent = 'Enviando…';
  setApprovalStatus('Registrando a solicitação. Aguarde.');
  try {
    const response = await createOrderPriceApproval(
      {
        ...input,
        justification,
        ...(supersededApprovalId ? { supersedesRequestId: supersededApprovalId } : {}),
      },
      approvalAttempt.idempotencyKey,
    );
    selectedApproval = (await getMyOrderPriceApproval(response.data.approval.id)).data;
    window.sessionStorage.setItem('order-price-approval-id', selectedApproval.id);
    supersededApprovalId = null;
    closeApprovalModal(false, true);
    setQuoteFeedback(`Solicitação enviada e aguardando análise. Nenhum pedido foi criado.`);
    renderCart();
    window.dispatchEvent(new Event('fluair:approval-notifications-refresh'));
  } catch (error) {
    setApprovalStatus(apiMessage(error, 'Não foi possível enviar a solicitação.'), true);
  } finally {
    approvalSubmitting = false;
    submit.disabled = false;
    cancel.disabled = false;
    submit.textContent = 'Enviar solicitação';
  }
}

function reviewTextCard(label: string, value: string): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'order-review-card';
  const caption = document.createElement('span');
  caption.className = 'order-review-label';
  caption.textContent = label;
  const content = document.createElement('strong');
  content.textContent = value;
  card.append(caption, content);
  return card;
}

function renderOrderReview(quote: OrderQuoteEnvelope['data']): void {
  const content = element<HTMLElement>('#order-review-content');
  clear(content);
  const summary = document.createElement('div');
  summary.className = 'order-review-summary';
  summary.append(
    reviewTextCard('Cliente', `${quote.customer.code} · ${quote.customer.legalName}`),
    reviewTextCard(
      'Emissor',
      quote.creator
        ? `${quote.creator.name} · ${quote.creator.email}`
        : (currentUser?.email ?? '---'),
    ),
    reviewTextCard('Destinatários', quote.recipients.join(', ')),
  );
  const items = document.createElement('div');
  items.className = 'order-review-items';
  for (const line of quote.lines) {
    const row = document.createElement('div');
    row.className = 'order-review-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    const code = line.kind === 'KIT' ? line.code : line.productCode;
    title.textContent = `${code} · ${line.description}`;
    const meta = document.createElement('div');
    meta.className = 'order-review-item-meta';
    meta.textContent =
      line.kind === 'KIT'
        ? `${line.priceList.name} · cálculo v${line.calculationVersion} · lista v${line.priceListVersion.version}`
        : `${line.priceList.name} · lista v${line.priceListVersion.version}${line.reference ? ` · ref. ${line.reference}` : ''}`;
    copy.append(title, meta);
    const values = document.createElement('div');
    values.className = 'order-review-item-values';
    values.textContent = `${line.quantity} × ${money(line.finalUnitPrice)} = ${money(line.subtotal)}`;
    if (line.taxes) {
      const taxes = document.createElement('div');
      const applied = line.taxes
        ? (['pis', 'cofins', 'icms', 'ipi'] as const)
            .filter((code) => line.taxes[code].selected)
            .map((code) => `${code.toUpperCase()} ${percentage(line.taxes[code].rate)}`)
        : [];
      taxes.textContent = line.taxes
        ? applied.length
          ? `Base ${money(line.negotiatedUnitPrice)} · ${applied.join(' · ')} · Impostos ${money(line.taxes.totalUnitAmount)}`
          : `Base ${money(line.negotiatedUnitPrice)} · sem impostos aplicados`
        : `IPI ${percentage(line.ipiRate)} · ICMS ${percentage(line.icmsRate)}`;
      values.append(taxes);
    }
    const reference = document.createElement('div');
    reference.textContent = `Valor de referência: ${money(line.referenceUnitPrice)}`;
    values.append(reference);
    row.append(copy, values);
    items.append(row);
  }
  const note = reviewTextCard(
    'Observação',
    element<HTMLTextAreaElement>('#pedidoObs').value.trim() || 'Sem observações.',
  );
  note.classList.add('order-review-note');
  content.append(summary, items, note);
  if (quote.warnings.length) {
    const warnings = reviewTextCard('Avisos da cotação', quote.warnings.join('\n'));
    warnings.classList.add('order-review-warnings');
    content.append(warnings);
  }
  const total = document.createElement('div');
  total.className = 'order-review-total';
  total.append(document.createTextNode(`${quote.totalQuantity} itens`));
  const amount = document.createElement('span');
  amount.textContent = money(quote.total);
  total.append(amount);
  content.append(total);
}

function setReviewStatus(message = '', error = false): void {
  const status = element<HTMLElement>('#order-review-status');
  status.textContent = message;
  status.hidden = !message;
  status.classList.toggle('error', error);
}

function closeOrderReview(restoreFocus = true, force = false): void {
  if (reviewSubmitting && !force) return;
  element<HTMLElement>('#order-review-modal').classList.remove('open');
  activeReview = null;
  setReviewStatus();
  if (restoreFocus) reviewFocusReturn?.focus();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function monitorEmailDelivery(
  orderId: string,
  orderNumber: string,
  deliveryId: string,
): Promise<void> {
  if (monitoredEmailDeliveries.has(deliveryId)) return;
  monitoredEmailDeliveries.add(deliveryId);
  const deadline = Date.now() + emailDeliveryMonitorTimeoutMs;
  let consecutiveFailures = 0;
  try {
    while (Date.now() < deadline) {
      try {
        const details = (await loadOrder(orderId)).data;
        consecutiveFailures = 0;
        const delivery = details.emailDeliveries.find((item) => item.id === deliveryId);
        if (delivery) {
          const notification = emailDeliveryNotification(orderNumber, delivery);
          if (notification) {
            showNotification(notification.message, notification.kind, 7_000);
            return;
          }
        }
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return;
        consecutiveFailures += 1;
        if (consecutiveFailures >= 3) {
          showNotification(
            `Pedido ${orderNumber} registrado, mas não foi possível acompanhar o envio do e-mail.`,
            'warning',
            7_000,
          );
          return;
        }
      }
      await wait(emailDeliveryPollIntervalMs);
    }
    showNotification(`O e-mail do pedido ${orderNumber} continua em processamento.`, 'info', 7_000);
  } finally {
    monitoredEmailDeliveries.delete(deliveryId);
  }
}

function openOrderReview(quote: OrderQuoteEnvelope['data']): void {
  activeReview = {
    quote,
    fingerprint: reviewFingerprint(),
    idempotencyKey: newIdempotencyKey(),
  };
  reviewFocusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderOrderReview(quote);
  element<HTMLElement>('#order-review-actions').hidden = false;
  setReviewStatus('Pedido validado. Revise os dados antes de confirmar.');
  const modal = element<HTMLElement>('#order-review-modal');
  modal.classList.add('open');
  window.requestAnimationFrame(() => element<HTMLButtonElement>('#order-confirm').focus());
}

async function confirmOrder(): Promise<void> {
  if (!activeReview || reviewSubmitting) return;
  if (activeReview.fingerprint !== reviewFingerprint()) {
    closeOrderReview(false);
    setQuoteFeedback(
      'O pedido mudou durante a revisão. Gere uma nova revisão antes de confirmar.',
      true,
    );
    return;
  }
  const input = orderInput();
  if (!input) return;
  const confirm = element<HTMLButtonElement>('#order-confirm');
  const back = element<HTMLButtonElement>('#order-review-back');
  reviewSubmitting = true;
  confirm.disabled = true;
  back.disabled = true;
  confirm.textContent = 'Registrando pedido…';
  setReviewStatus('Registrando o pedido. Aguarde.');
  try {
    window.clearTimeout(draftSaveTimer);
    draftSaveSequence += 1;
    await draftSaveInFlight;
    const response = await createOrder(
      {
        ...input,
        note: element<HTMLTextAreaElement>('#pedidoObs').value,
        quoteToken: activeReview.quote.quoteToken,
        ...(selectedApproval?.status === 'APPROVED'
          ? { approvalRequestId: selectedApproval.id }
          : {}),
      },
      activeReview.idempotencyKey,
    );
    const { order, emailDelivery } = response.data;
    if (selectedCustomer)
      savedDrafts = savedDrafts.filter((draft) => draft.customer.id !== selectedCustomer?.id);
    selectedApproval = null;
    quotedViolations = [];
    cart = [];
    pendingCalculation = null;
    element<HTMLTextAreaElement>('#pedidoObs').value = '';
    renderCart();
    renderSavedDrafts();
    window.dispatchEvent(new Event('fluair:approval-notifications-refresh'));
    setQuoteFeedback(`Pedido ${order.number} registrado; envio em processamento.`);
    closeOrderReview(false, true);
    element<HTMLButtonElement>('#pedido-client-trigger').focus();
    showNotification(
      `Pedido ${order.number} registrado. Envio do e-mail em processamento.`,
      'info',
      7_000,
    );
    void monitorEmailDelivery(order.id, order.number, emailDelivery.id);
  } catch (error) {
    const stale = error instanceof ApiError && error.code === 'ORDER_QUOTE_STALE';
    setReviewStatus(
      stale
        ? 'A cotação mudou. Feche esta revisão e gere uma nova antes de confirmar.'
        : apiMessage(error, 'Não foi possível registrar o pedido. Tente novamente.'),
      true,
    );
    if (
      error instanceof ApiError &&
      [
        'ORDER_PRICE_APPROVAL_EXPIRED',
        'ORDER_PRICE_APPROVAL_CONTENT_MISMATCH',
        'ORDER_PRICE_APPROVAL_ALREADY_CONSUMED',
      ].includes(error.code)
    ) {
      selectedApproval = null;
      window.sessionStorage.removeItem('order-price-approval-id');
      window.dispatchEvent(new Event('fluair:approval-notifications-refresh'));
    }
  } finally {
    reviewSubmitting = false;
    confirm.disabled = false;
    back.disabled = false;
    confirm.textContent = 'Confirmar e enviar pedido';
  }
}

function approvalCart(detail: MyOrderPriceApprovalDetail): CartItem[] {
  return detail.items.map((item) => {
    const restored: CartItem = {
      key:
        item.kind === 'KIT'
          ? `kit:${item.sourceCalculationVersionId}:${item.priceReference}`
          : `product:${item.code}:${item.sourcePriceListVersionId}`,
      kind: item.kind,
      code: item.code,
      description: item.description,
      price: Number(item.negotiatedUnitPrice),
      taxRate: Number(item.ipiRate ?? 0),
      taxes: item.taxes
        ? {
            pis: { selected: item.taxes.pis.selected, rate: Number(item.taxes.pis.rate) },
            cofins: {
              selected: item.taxes.cofins.selected,
              rate: Number(item.taxes.cofins.rate),
            },
            icms: { selected: item.taxes.icms.selected, rate: Number(item.taxes.icms.rate) },
            ipi: { selected: item.taxes.ipi.selected, rate: Number(item.taxes.ipi.rate) },
          }
        : defaultTaxes({
            pis: Number(item.pisRate ?? 0),
            cofins: Number(item.cofinsRate ?? 0),
            icms: Number(item.icmsRate ?? 0),
            ipi: Number(item.ipiRate ?? 0),
          }),
      referencePrice: Number(item.referenceUnitPrice),
      priceEdited: item.negotiatedUnitPrice !== item.referenceUnitPrice,
      priceReference: item.priceReference,
      source: `${item.priceList.name} · faixa ${compactRangeLabel(item.priceList.minimumOrderQuantity, item.priceList.maximumOrderQuantity, '')} · lista v${item.priceList.version}`,
      sourceVersionId: item.sourcePriceListVersionId,
      priceListName: item.priceList.name,
      priceListVersion: item.priceList.version,
      minimumOrderQuantity: item.priceList.minimumOrderQuantity,
      maximumOrderQuantity: item.priceList.maximumOrderQuantity,
      minimumPrice: Number(item.minimumUnitPrice),
      normalPrice: Number(item.referenceUnitPrice),
      quantity: Number(item.quantity),
      image: null,
    };
    if (item.kind === 'STANDALONE_PRODUCT') {
      restored.priceRanges = [
        {
          list: `${item.priceList.name} · comparação`,
          minimumPrice: Number(item.minimumUnitPrice),
          maximumPrice: Number(item.referenceUnitPrice),
          pisRate: Number(item.pisRate ?? 0),
          cofinsRate: Number(item.cofinsRate ?? 0),
          ipiRate: Number(item.ipiRate ?? 0),
          icmsRate: Number(item.icmsRate ?? 0),
        },
      ];
    }
    if (item.ipiRate !== null) restored.ipiRate = Number(item.ipiRate);
    if (item.icmsRate !== null) restored.icmsRate = Number(item.icmsRate);
    if (item.pisRate != null) restored.pisRate = Number(item.pisRate);
    if (item.cofinsRate != null) restored.cofinsRate = Number(item.cofinsRate);
    if (item.sourceCalculationVersionId) restored.calculationId = item.sourceCalculationVersionId;
    return restored;
  });
}

async function loadApprovalIntoCart(id: string): Promise<void> {
  setQuoteFeedback('Recuperando o carrinho da solicitação…');
  try {
    const detail = (await getMyOrderPriceApproval(id)).data;
    if (selectedCustomer?.id !== detail.customer.id) {
      const customer = (await getCustomer(detail.customer.id)).data.customer;
      await selectCustomer(customer);
      if (selectedCustomer?.id !== customer.id) return;
    }
    selectedApproval = detail;
    window.sessionStorage.setItem('order-price-approval-id', detail.id);
    supersededApprovalId = detail.status === 'PENDING' ? detail.id : null;
    cart = approvalCart(detail);
    quotedViolations = detail.items
      .filter((item) => item.requiresApproval)
      .map((item) => ({
        line: item.lineNumber,
        kind: item.kind,
        code: item.code,
        priceListVersionId: item.sourcePriceListVersionId,
        priceListName: item.priceList.name,
        minimumOrderQuantity: item.priceList.minimumOrderQuantity,
        maximumOrderQuantity: item.priceList.maximumOrderQuantity,
        quantity: item.quantity,
        minimumUnitPrice: item.minimumUnitPrice,
        negotiatedUnitPrice: item.negotiatedUnitPrice,
        unitDifference: item.exceptionUnitAmount,
        totalDifference: item.exceptionTotalAmount,
        differencePercentage:
          Number(item.minimumUnitPrice) > 0
            ? ((Number(item.exceptionUnitAmount) / Number(item.minimumUnitPrice)) * 100).toFixed(4)
            : '0.0000',
      }));
    syncSelectedCustomer();
    renderCustomers(customers.length);
    renderCart();
    void loadCatalog();
    setQuoteFeedback(
      detail.status === 'APPROVED'
        ? 'Aprovação carregada. Gere uma nova cotação para revisar e confirmar o pedido.'
        : approvalStatusMessage(detail),
    );
  } catch (error) {
    setQuoteFeedback(apiMessage(error, 'Não foi possível recuperar a solicitação.'), true);
  }
}

function setPickerOpen(open: boolean): void {
  const picker = element<HTMLElement>('#pedidoClientePicker');
  const trigger = element<HTMLButtonElement>('#pedido-client-trigger');
  picker.classList.toggle('open', open);
  trigger.setAttribute('aria-expanded', String(open));
  if (open)
    window.requestAnimationFrame(() => element<HTMLInputElement>('#pedidoClienteSearch').focus());
}

function syncSelectedCustomer(): void {
  element<HTMLInputElement>('#pedidoCliente').value = selectedCustomer?.id ?? '';
  element<HTMLElement>('#pedidoClientePicker').classList.toggle(
    'has-selection',
    Boolean(selectedCustomer),
  );
  element<HTMLButtonElement>('#pedido-client-clear').hidden = !selectedCustomer;
  const label = element<HTMLElement>('#pedidoClienteTriggerLabel');
  label.textContent = selectedCustomer?.legalName ?? 'Escolha um cliente para este pedido';
  label.classList.toggle('placeholder', !selectedCustomer);
  element<HTMLElement>('#pedidoClienteTriggerMeta').textContent = selectedCustomer
    ? customerDetails(selectedCustomer)
    : 'Busque por código, razão social ou segmento';
}

function draftPayload() {
  return {
    note: element<HTMLTextAreaElement>('#pedidoObs').value,
    cart: cart.map((item) => {
      const savedItem: CartItem = {
        ...item,
        image: item.image ? { ...item.image } : null,
        ...(item.priceRanges
          ? { priceRanges: item.priceRanges.map((range) => ({ ...range })) }
          : {}),
      };
      delete savedItem.lastOrderPrice;
      return savedItem;
    }),
    ...(selectedApproval ? { approvalRequestId: selectedApproval.id } : {}),
  };
}

function showEvictedDraft(draft: OrderDraft | null | undefined): void {
  if (!draft) return;
  showNotification(
    `O pedido em andamento de ${draft.customer.legalName} foi removido para salvar o cliente mais recente.`,
    'info',
    7_000,
  );
}

function renderSavedDrafts(): void {
  const panel = element<HTMLElement>('#order-draft-history');
  const container = element<HTMLElement>('#order-draft-tabs');
  panel.hidden = !savedDrafts.length;
  clear(container);
  if (!savedDrafts.length) return;

  savedDrafts.forEach((draft) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'order-draft-tab-wrap';
    const active = draft.customer.id === selectedCustomer?.id;
    wrapper.classList.toggle('active', active);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'order-draft-tab';
    button.disabled = !draft.customer.active;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', `Retomar pedido de ${draft.customer.legalName}`);
    button.title = `${draft.customer.code} · ${draft.customer.legalName}`;
    const name = document.createElement('span');
    name.className = 'order-draft-tab-name';
    name.textContent = customerDraftLabel(draft.customer.code, draft.customer.legalName);
    const quantity = document.createElement('span');
    quantity.className = 'order-draft-tab-count';
    quantity.textContent = String(orderTotalQuantity(draft.payload.cart));
    button.append(name, quantity);
    button.addEventListener('click', () => void resumeSavedDraft(draft));
    const discard = document.createElement('button');
    discard.type = 'button';
    discard.className = 'order-draft-tab-discard';
    discard.textContent = '×';
    discard.setAttribute('aria-label', `Descartar pedido de ${draft.customer.legalName}`);
    discard.title = `Descartar pedido de ${draft.customer.legalName}`;
    discard.addEventListener('click', () => void discardSavedDraft(draft));
    wrapper.append(button, discard);
    container.append(wrapper);
  });
}

async function loadSavedDraft(): Promise<void> {
  const sequence = ++draftSequence;
  try {
    const response = await loadOrderDraft();
    if (sequence !== draftSequence) return;
    savedDrafts = response.data.drafts ?? (response.data.draft ? [response.data.draft] : []);
    renderSavedDrafts();
    renderCustomers(customers.length);
  } catch (error) {
    if (sequence !== draftSequence) return;
    savedDrafts = [];
    renderSavedDrafts();
    setRangeWarning(apiMessage(error, 'Não foi possível consultar o pedido anterior salvo.'));
  }
}

async function restoreDraftApproval(id: string): Promise<void> {
  try {
    const detail = (await getMyOrderPriceApproval(id)).data;
    if (detail.customer.id !== selectedCustomer?.id) return;
    selectedApproval = detail;
    window.sessionStorage.setItem('order-price-approval-id', detail.id);
    updateCartSummary();
  } catch {
    selectedApproval = null;
    window.sessionStorage.removeItem('order-price-approval-id');
  }
}

async function discardSavedDraft(draft: OrderDraft): Promise<void> {
  if (!window.confirm(`Descartar o pedido em andamento de ${draft.customer.legalName}?`)) return;
  const customerId = draft.customer.id;
  try {
    window.clearTimeout(draftSaveTimer);
    draftSaveSequence += 1;
    await draftSaveInFlight;
    await deleteOrderDraft(customerId);
    savedDrafts = savedDrafts.filter((item) => item.customer.id !== customerId);
    if (selectedCustomer?.id === customerId) {
      selectedCustomer = null;
      selectedPriceList = null;
      selectedApproval = null;
      pendingCalculation = null;
      cart = [];
      window.sessionStorage.removeItem('order-price-approval-id');
      element<HTMLTextAreaElement>('#pedidoObs').value = '';
      syncSelectedCustomer();
      renderCart();
      void loadCatalog();
    } else if (selectedCustomer && cart.length) {
      scheduleDraftAutosave();
    }
    renderSavedDrafts();
    renderCustomers(customers.length);
    showNotification('Pedido em andamento descartado.', 'info');
  } catch (error) {
    setRangeWarning(apiMessage(error, 'Não foi possível descartar o pedido anterior.'));
  }
}

async function resumeSavedDraft(draft: OrderDraft): Promise<void> {
  if (!draft.customer.active || draft.customer.id === selectedCustomer?.id) return;
  try {
    const customer = (await getCustomer(draft.customer.id)).data.customer;
    await selectCustomer(customer);
  } catch (error) {
    setRangeWarning(apiMessage(error, 'Não foi possível retomar o pedido anterior.'));
  }
}

async function saveActiveDraft(sequence: number): Promise<void> {
  const customer = selectedCustomer;
  if (!customer || customerSwitching) return;
  if (!cart.length) {
    if (!savedDrafts.some((draft) => draft.customer.id === customer.id)) return;
    try {
      await deleteOrderDraft(customer.id);
      if (sequence !== draftSaveSequence || selectedCustomer?.id !== customer.id) return;
      savedDrafts = savedDrafts.filter((draft) => draft.customer.id !== customer.id);
      renderSavedDrafts();
    } catch (error) {
      setRangeWarning(apiMessage(error, 'Não foi possível atualizar o histórico de pedidos.'));
    }
    return;
  }
  try {
    const response = await saveOrderDraft({ customerId: customer.id, payload: draftPayload() });
    if (sequence !== draftSaveSequence || selectedCustomer?.id !== customer.id) return;
    savedDrafts = response.data.drafts ?? (response.data.draft ? [response.data.draft] : []);
    showEvictedDraft(response.data.evicted);
    renderSavedDrafts();
    renderCustomers(customers.length);
  } catch (error) {
    setRangeWarning(apiMessage(error, 'Não foi possível salvar o pedido automaticamente.'));
  }
}

function scheduleDraftAutosave(): void {
  window.clearTimeout(draftSaveTimer);
  const sequence = ++draftSaveSequence;
  draftSaveTimer = window.setTimeout(() => {
    const pending = saveActiveDraft(sequence);
    draftSaveInFlight = pending;
    void pending.finally(() => {
      if (draftSaveInFlight === pending) draftSaveInFlight = null;
    });
  }, 700);
}

async function clearSelectedCustomer(): Promise<void> {
  if (!selectedCustomer || customerSwitching) return;
  window.clearTimeout(draftSaveTimer);
  draftSaveSequence += 1;
  const customer = selectedCustomer;
  const hadOrder = cart.length > 0;

  if (hadOrder) {
    customerSwitching = true;
    setRangeWarning('Salvando o pedido em montagem…');
    try {
      await draftSaveInFlight;
      const response = await saveOrderDraft({
        customerId: customer.id,
        payload: draftPayload(),
      });
      savedDrafts = response.data.drafts ?? (response.data.draft ? [response.data.draft] : []);
      showEvictedDraft(response.data.evicted);
    } catch (error) {
      setRangeWarning(
        apiMessage(error, 'Não foi possível salvar o pedido. O cliente não foi removido.'),
      );
      customerSwitching = false;
      return;
    }
  }

  selectedCustomer = null;
  selectedPriceList = null;
  pendingCalculation = null;
  cart = [];
  element<HTMLTextAreaElement>('#pedidoObs').value = '';
  element<HTMLInputElement>('#pedidoClienteSearch').value = '';
  element<HTMLButtonElement>('#order-reload-lists').hidden = true;
  setPickerOpen(false);
  syncSelectedCustomer();
  renderCustomers(customers.length);
  setRangeWarning(hadOrder ? 'Pedido em montagem salvo.' : '');
  invalidateQuote();
  renderCart();
  void loadCatalog();
  renderSavedDrafts();
  customerSwitching = false;
  element<HTMLButtonElement>('#pedido-client-trigger').focus();
}

async function selectCustomer(customer: Customer): Promise<void> {
  if (customerSwitching) return;
  window.clearTimeout(draftSaveTimer);
  draftSaveSequence += 1;
  const hadPreviousCustomer = Boolean(selectedCustomer);
  const changed = selectedCustomer?.id !== customer.id;
  if (!changed) {
    setPickerOpen(false);
    return;
  }
  const previousCustomer = selectedCustomer;
  const previousHadOrder = Boolean(previousCustomer && cart.length);
  customerSwitching = true;
  setRangeWarning(previousHadOrder ? 'Salvando o pedido anterior…' : 'Carregando pedido…');
  let restored: OrderDraft | null = null;
  try {
    await draftSaveInFlight;
    const response = await swapOrderDraft({
      targetCustomerId: customer.id,
      ...(previousHadOrder && previousCustomer
        ? { current: { customerId: previousCustomer.id, payload: draftPayload() } }
        : {}),
    });
    restored = response.data.restored;
    savedDrafts = response.data.drafts ?? (response.data.draft ? [response.data.draft] : []);
    showEvictedDraft(response.data.evicted);
  } catch (error) {
    setRangeWarning(
      apiMessage(error, 'Não foi possível salvar o pedido anterior. O cliente não foi alterado.'),
    );
    customerSwitching = false;
    return;
  }

  selectedCustomer = customer;
  selectedApproval = null;
  element<HTMLTextAreaElement>('#pedidoObs').value =
    restored?.payload.note ?? customer.orderNote ?? '';
  element<HTMLInputElement>('#pedidoClienteSearch').value = '';
  syncSelectedCustomer();
  renderCustomers(customers.length);
  setPickerOpen(false);
  invalidateQuote();
  cart = restored
    ? restored.payload.cart.map((item) => ({
        ...item,
        image: item.image ? { ...item.image } : null,
        ...(item.priceRanges
          ? { priceRanges: item.priceRanges.map((range) => ({ ...range })) }
          : {}),
      }))
    : [];
  if (!restored) applyPendingCalculation();
  setRangeWarning(
    restored
      ? `Pedido anterior de ${customer.legalName} retomado.`
      : hadPreviousCustomer
        ? previousHadOrder
          ? 'Cliente alterado. O pedido anterior foi salvo.'
          : 'Cliente alterado.'
        : 'Cliente selecionado. O catálogo agora mostra apenas ofertas compatíveis.',
  );
  renderCart();
  void refreshLastSalePrices();
  renderSavedDrafts();
  void loadCatalog();
  if (restored?.payload.approvalRequestId)
    void restoreDraftApproval(restored.payload.approvalRequestId);
  customerSwitching = false;
  element<HTMLButtonElement>('#pedido-client-trigger').focus();
}

function customerOption(customer: Customer): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cliente-option${selectedCustomer?.id === customer.id ? ' active' : ''}`;
  button.setAttribute('role', 'option');
  button.setAttribute('aria-selected', String(selectedCustomer?.id === customer.id));
  const code = document.createElement('div');
  code.className = 'cliente-option-code';
  code.textContent = customer.code;
  const main = document.createElement('div');
  main.className = 'cliente-option-main';
  const name = document.createElement('div');
  name.className = 'cliente-option-name';
  name.textContent = customer.legalName;
  const meta = document.createElement('div');
  meta.className = 'cliente-option-meta';
  meta.textContent = customerDetails(customer);
  main.append(name, meta);
  if (
    savedDrafts.some((draft) => draft.customer.id === customer.id) &&
    selectedCustomer?.id !== customer.id
  ) {
    const saved = document.createElement('small');
    saved.className = 'order-customer-draft-label';
    saved.textContent = 'Pedido em andamento';
    main.append(saved);
  }
  const tag = document.createElement('div');
  tag.className = 'cliente-option-tag';
  tag.textContent = customer.customerSegment?.name ?? customer.segment ?? 'Sem segmento';
  button.append(code, main, tag);
  button.addEventListener('click', () => void selectCustomer(customer));
  return button;
}

function customerClassificationOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function populatePreRegistrationClassifications(): void {
  const classSelect = element<HTMLSelectElement>('#order-customer-class');
  const segmentSelect = element<HTMLSelectElement>('#order-customer-segment');
  clear(classSelect);
  clear(segmentSelect);
  classSelect.append(customerClassificationOption('', 'Selecione a classe'));
  segmentSelect.append(customerClassificationOption('', 'Selecione o segmento'));
  for (const item of customerClasses)
    classSelect.append(customerClassificationOption(item.id, item.name));
  for (const item of customerSegments)
    segmentSelect.append(customerClassificationOption(item.id, item.name));
}

function setPreRegistrationError(message = ''): void {
  const error = element<HTMLElement>('#order-customer-pre-error');
  error.textContent = message;
  error.hidden = !message;
}

function closePreRegistration(): void {
  element<HTMLElement>('#order-customer-pre-modal').classList.remove('open');
  element<HTMLFormElement>('#order-customer-pre-form').reset();
  setPreRegistrationError();
  element<HTMLButtonElement>('#order-customer-add').focus();
}

async function openPreRegistration(): Promise<void> {
  if (!canManageCustomers()) return;
  setPickerOpen(false);
  setPreRegistrationError();
  customerClasses = [];
  customerSegments = [];
  populatePreRegistrationClassifications();
  const modal = element<HTMLElement>('#order-customer-pre-modal');
  modal.classList.add('open');
  const submit = element<HTMLButtonElement>('#order-customer-pre-submit');
  submit.disabled = true;
  try {
    const response = await listCustomerClassifications();
    customerClasses = response.data.customerClasses;
    customerSegments = response.data.customerSegments;
    populatePreRegistrationClassifications();
    element<HTMLInputElement>('#order-customer-legal-name').focus();
  } catch (error) {
    setPreRegistrationError(
      apiMessage(error, 'Não foi possível carregar as classes e os segmentos.'),
    );
  } finally {
    submit.disabled = !customerClasses.length || !customerSegments.length;
  }
}

async function submitPreRegistration(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const submit = element<HTMLButtonElement>('#order-customer-pre-submit');
  submit.disabled = true;
  setPreRegistrationError();
  try {
    const response = await preRegisterCustomer({
      legalName: element<HTMLInputElement>('#order-customer-legal-name').value.trim(),
      customerClassId: element<HTMLSelectElement>('#order-customer-class').value,
      customerSegmentId: element<HTMLSelectElement>('#order-customer-segment').value,
    });
    const customer = response.data.customer;
    customers = [customer, ...customers.filter((item) => item.id !== customer.id)];
    element<HTMLElement>('#order-customer-pre-modal').classList.remove('open');
    form.reset();
    await selectCustomer(customer);
  } catch (error) {
    setPreRegistrationError(apiMessage(error, 'Não foi possível pré-cadastrar o cliente.'));
  } finally {
    submit.disabled = false;
  }
}

function renderCustomers(total: number): void {
  const container = element<HTMLElement>('#pedidoClienteOptions');
  clear(container);
  if (!customers.length) {
    container.append(state('Nenhum cliente ativo encontrado com esse termo.'));
    return;
  }
  for (const customer of customers) container.append(customerOption(customer));
  if (total > customers.length)
    container.append(
      state(`Mostrando ${customers.length} de ${total.toLocaleString('pt-BR')} clientes.`),
    );
}

async function loadCustomers(): Promise<void> {
  const container = element<HTMLElement>('#pedidoClienteOptions');
  if (!canViewCustomers()) {
    clear(container);
    container.append(state('Você não possui permissão para consultar clientes.'));
    return;
  }
  const sequence = ++customerSequence;
  clear(container);
  container.append(state('Carregando clientes…'));
  try {
    const response = await listCustomers({
      search: element<HTMLInputElement>('#pedidoClienteSearch').value.trim(),
      status: 'active',
      page: 1,
      pageSize: 25,
    });
    if (sequence !== customerSequence) return;
    customers = response.data.customers;
    renderCustomers(response.data.pagination.total);
  } catch (error) {
    if (sequence !== customerSequence) return;
    clear(container);
    container.append(state(apiMessage(error, 'Não foi possível carregar os clientes.')));
  }
}

function rangeLabel(list: EligibleOrderPriceList): string {
  if (list.minimumOrderQuantity === null && list.maximumOrderQuantity === null)
    return 'Sem faixa de quantidade';
  if (list.minimumOrderQuantity === null) return `Até ${list.maximumOrderQuantity} itens`;
  if (list.maximumOrderQuantity === null) return `A partir de ${list.minimumOrderQuantity} itens`;
  return `${list.minimumOrderQuantity} a ${list.maximumOrderQuantity} itens`;
}

function compactRangeLabel(
  minimum: number | null,
  maximum: number | null,
  priceListName: string,
): string {
  if (minimum === null && maximum === null) return priceListName;
  if (minimum === null) return `Até ${maximum}`;
  if (maximum === null) return `${minimum}+`;
  return `${minimum}-${maximum}`;
}

function renderPriceLists(): void {
  const container = element<HTMLElement>('#order-price-lists');
  clear(container);
  if (!priceLists.length) {
    setVisibleCatalogItems([]);
    element<HTMLElement>('#order-catalog-count').textContent = '';
    element<HTMLElement>('#order-pagination').hidden = true;
    return;
  }
  for (const list of priceLists) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `order-list-option${selectedPriceList?.id === list.id ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(selectedPriceList?.id === list.id));
    const title = document.createElement('strong');
    title.textContent = `${list.code} · ${list.name}`;
    const detail = document.createElement('small');
    detail.textContent = `${rangeLabel(list)} · versão ${list.activeVersion.version}`;
    button.append(title, detail);
    button.addEventListener('click', () => {
      invalidateQuote();
      selectedPriceList = list;
      setRangeWarning();
      catalogPage = 1;
      renderPriceLists();
      void loadCatalog();
    });
    container.append(button);
  }
}

async function loadPriceLists(): Promise<void> {
  const sequence = ++priceListSequence;
  const container = element<HTMLElement>('#order-price-lists');
  selectedPriceList = null;
  priceLists = [];
  element<HTMLElement>('#order-pagination').hidden = true;
  setVisibleCatalogItems([]);
  element<HTMLElement>('#order-catalog-count').textContent = '';
  if (!selectedCustomer) {
    clear(container);
    container.append(state('Selecione um cliente para consultar as listas permitidas.'));
    return;
  }
  clear(container);
  container.append(state('Consultando listas autorizadas…'));
  try {
    const response = await listEligibleOrderPriceLists(selectedCustomer.id, lineQuantities());
    if (sequence !== priceListSequence) return;
    priceLists = response.data.priceLists;
    renderPriceLists();
    if (!selectedPriceList) void loadSavedCatalog(selectedCustomer.id);
  } catch (error) {
    if (sequence !== priceListSequence) return;
    clear(container);
    container.append(state(apiMessage(error, 'Não foi possível consultar as listas permitidas.')));
    if (selectedCustomer) void loadSavedCatalog(selectedCustomer.id);
  }
}

function addToCart(item: CartItem): void {
  invalidateQuote();
  const existing = cart.find(({ key }) => key === item.key);
  if (existing) existing.quantity += 1;
  else cart.push(item);
  revalidateAfterCartChange();
}

function revalidateAfterCartChange(): void {
  invalidateQuote();
  renderCart();
  void refreshLastSalePrices();
  scheduleDraftAutosave();
}

async function refreshLastSalePrices(): Promise<void> {
  const sequence = ++lastSalePriceSequence;
  const customer = selectedCustomer;
  if (!customer || !cart.length) return;

  lastSalePricesFailed = false;
  for (const item of cart) delete item.lastOrderPrice;
  renderCart();
  try {
    const response = await loadLastSalePrices({
      customerId: customer.id,
      lines: cart.map((item) =>
        item.kind === 'KIT'
          ? { key: item.key, kind: item.kind, calculationId: item.calculationId! }
          : { key: item.key, kind: item.kind, productCode: item.code },
      ),
    });
    if (sequence !== lastSalePriceSequence || selectedCustomer?.id !== customer.id) return;
    const prices = new Map(
      response.data.prices.map((item) => [item.key, item.lastOrderPrice] as const),
    );
    for (const item of cart) item.lastOrderPrice = prices.get(item.key) ?? null;
    renderCart();
  } catch {
    if (sequence !== lastSalePriceSequence || selectedCustomer?.id !== customer.id) return;
    for (const item of cart) delete item.lastOrderPrice;
    lastSalePricesFailed = true;
    renderCart();
  }
}

function catalogLastSaleKey(item: CatalogItem): string {
  return item.kind === 'KIT' ? `kit:${item.calculationId}` : `product:${item.code}`;
}

async function refreshDrawerLastSalePrices(
  items: CatalogItem[],
  catalogRequestSequence: number,
): Promise<void> {
  const sequence = ++drawerLastSalePriceSequence;
  const customer = selectedCustomer;
  drawerLastSalePrices = new Map();
  drawerLastSalePricesFailed = false;
  renderDrawerCatalog();
  if (!customer || !items.length) return;

  try {
    const response = await loadLastSalePrices({
      customerId: customer.id,
      lines: items.map((item) =>
        item.kind === 'KIT'
          ? {
              key: catalogLastSaleKey(item),
              kind: item.kind,
              calculationId: item.calculationId,
            }
          : {
              key: catalogLastSaleKey(item),
              kind: item.kind,
              productCode: item.code,
            },
      ),
    });
    if (
      sequence !== drawerLastSalePriceSequence ||
      catalogRequestSequence !== catalogSequence ||
      selectedCustomer?.id !== customer.id
    )
      return;
    drawerLastSalePrices = new Map(
      response.data.prices.map((item) => [item.key, item.lastOrderPrice] as const),
    );
    renderDrawerCatalog();
  } catch {
    if (
      sequence !== drawerLastSalePriceSequence ||
      catalogRequestSequence !== catalogSequence ||
      selectedCustomer?.id !== customer.id
    )
      return;
    drawerLastSalePricesFailed = true;
    renderDrawerCatalog();
  }
}

function catalogCard(item: CatalogItem, canAdd = true): HTMLDivElement {
  const card = document.createElement('div');
  card.className = `item-card order-clickable-card${canAdd ? '' : ' disabled'}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', canAdd ? '0' : '-1');
  card.setAttribute('aria-disabled', String(!canAdd));
  card.setAttribute('aria-label', `Adicionar ${item.code} ao pedido`);
  const badge = document.createElement('span');
  badge.className = `order-kind ${item.kind === 'KIT' ? 'kit' : 'product'}`;
  badge.textContent =
    item.kind === 'KIT'
      ? item.scope === 'STANDARD'
        ? 'Kit padrão'
        : 'Kit do cliente'
      : 'Produto avulso';
  const photo = createMediaImage({
    image: item.image ?? null,
    entityLabel: item.kind === 'KIT' ? 'Kit' : 'Produto',
    code: item.code,
    description: descriptionWithoutUser(item.description),
    width: 88,
    height: 66,
    expandable: true,
  });
  const code = document.createElement('div');
  code.className = 'item-cod';
  code.textContent = item.code;
  const description = document.createElement('div');
  description.className = 'item-desc';
  description.textContent = descriptionWithoutUser(item.description);
  const source = document.createElement('div');
  source.className = 'order-source';
  const lastSale = document.createElement('div');
  lastSale.className = 'order-card-last-price';
  if (selectedCustomer) {
    const lastOrderPrice = drawerLastSalePrices.get(catalogLastSaleKey(item));
    lastSale.textContent = drawerLastSalePricesFailed
      ? 'Última venda indisponível'
      : lastOrderPrice === undefined
        ? 'Consultando última venda…'
        : lastOrderPrice
          ? `Última venda: ${money(lastOrderPrice.unitPrice)}`
          : 'Ainda não vendido para este cliente';
    if (lastOrderPrice) {
      lastSale.title = `${lastOrderPrice.orderNumber} · ${date(lastOrderPrice.orderedAt)}`;
    }
  }
  const prices = document.createElement('div');
  prices.className = 'order-card-prices';
  const priceInfo = (label: string, value: number | string): HTMLSpanElement => {
    const node = document.createElement('span');
    node.className = `order-card-price${label === 'Preço' ? '' : ' reference-price'}`;
    node.textContent = `${label} · ${money(value)}`;
    return node;
  };
  let cartItem: CartItem;
  if (item.kind === 'STANDALONE_PRODUCT') {
    prices.classList.add('ranges');
    const compatibleLists = `${item.priceRanges.length} ${item.priceRanges.length === 1 ? 'lista compatível' : 'listas compatíveis'}`;
    source.textContent = compatibleLists;
    const cartRanges = item.priceRanges.map((range) => ({
      list: range.priceList.name,
      minimumPrice: Number(range.minimumPrice),
      maximumPrice: Number(range.maximumPrice),
      pisRate: Number(range.pisRate ?? 0),
      cofinsRate: Number(range.cofinsRate ?? 0),
      ipiRate: Number(range.ipiRate ?? 0),
      icmsRate: Number(range.icmsRate ?? 0),
    }));
    const productCartItem = (range: (typeof item.priceRanges)[number] | undefined): CartItem => ({
      key: `product:${item.code}:${range?.priceListVersionId ?? item.priceListVersionId}`,
      kind: item.kind,
      code: item.code,
      description: descriptionWithoutUser(item.description),
      price: Number(range?.maximumPrice ?? item.unitPrice),
      taxRate: Number(range?.ipiRate ?? item.ipiRate ?? 0),
      taxes: defaultTaxes({
        pis: Number(range?.pisRate ?? item.pisRate ?? 0),
        cofins: Number(range?.cofinsRate ?? item.cofinsRate ?? 0),
        icms: Number(range?.icmsRate ?? item.icmsRate ?? 0),
        ipi: Number(range?.ipiRate ?? item.ipiRate ?? 0),
      }),
      referencePrice: Number(range?.maximumPrice ?? item.unitPrice),
      priceEdited: false,
      priceReference: 'UNIT',
      source: range
        ? `${range.priceList.name} · lista v${range.priceListVersion}`
        : `${compatibleLists} · referência pela maior oferta`,
      sourceVersionId: range?.priceListVersionId ?? item.priceListVersionId,
      priceListName: range?.priceList.name ?? item.priceList.name,
      priceListVersion: range?.priceListVersion ?? item.priceListVersion,
      minimumOrderQuantity: range?.minimumOrderQuantity ?? null,
      maximumOrderQuantity: range?.maximumOrderQuantity ?? null,
      minimumPrice: Number(range?.minimumPrice ?? item.minimumPrice),
      normalPrice: Number(range?.maximumPrice ?? item.maximumPrice),
      priceRanges: cartRanges,
      ipiRate: Number(range?.ipiRate ?? item.ipiRate ?? 0),
      icmsRate: Number(range?.icmsRate ?? item.icmsRate ?? 0),
      pisRate: Number(range?.pisRate ?? item.pisRate ?? 0),
      cofinsRate: Number(range?.cofinsRate ?? item.cofinsRate ?? 0),
      quantity: 1,
      image: item.image ?? null,
    });
    for (const range of [...item.priceRanges].sort((left, right) => {
      const leftMinimum = left.minimumOrderQuantity ?? Number.NEGATIVE_INFINITY;
      const rightMinimum = right.minimumOrderQuantity ?? Number.NEGATIVE_INFINITY;
      if (leftMinimum !== rightMinimum) return leftMinimum < rightMinimum ? -1 : 1;
      const leftMaximum = left.maximumOrderQuantity ?? Number.POSITIVE_INFINITY;
      const rightMaximum = right.maximumOrderQuantity ?? Number.POSITIVE_INFINITY;
      if (leftMaximum !== rightMaximum) return leftMaximum < rightMaximum ? -1 : 1;
      return left.priceList.name.localeCompare(right.priceList.name, 'pt-BR');
    })) {
      const price = document.createElement('button');
      price.type = 'button';
      price.className = 'order-card-price order-card-price-range reference-price';
      price.textContent = `${compactRangeLabel(range.minimumOrderQuantity, range.maximumOrderQuantity, range.priceList.name)}: ${money(range.maximumPrice)}`;
      price.title = range.priceList.name;
      price.disabled = !canAdd;
      price.setAttribute(
        'aria-label',
        `Adicionar ${item.code} por ${money(range.maximumPrice)} da lista ${range.priceList.name}`,
      );
      price.addEventListener('click', (event) => {
        event.stopPropagation();
        if (canAdd) addToCart(productCartItem(range));
      });
      prices.append(price);
    }
    cartItem = productCartItem(undefined);
  } else if (item.kind === 'KIT') {
    source.textContent = `${item.priceList.name} · cálculo v${item.calculationVersion} · lista v${item.priceListVersion.version}`;
    prices.append(priceInfo('Mínimo', item.minimumPrice), priceInfo('Máximo', item.normalPrice));
    cartItem = {
      key: `kit:${item.calculationId}:NORMAL`,
      kind: item.kind,
      code: item.code,
      description: descriptionWithoutUser(item.description),
      price: Number(item.normalPrice),
      taxRate: Number(item.ipiRate ?? 0),
      taxes: defaultTaxes({
        pis: Number(item.pisRate ?? 0),
        cofins: Number(item.cofinsRate ?? 0),
        icms: Number(item.icmsRate ?? 0),
        ipi: Number(item.ipiRate ?? 0),
      }),
      referencePrice: Number(item.normalPrice),
      priceEdited: false,
      priceReference: 'NORMAL',
      source: `${item.priceList.name} · cálculo v${item.calculationVersion} · lista v${item.priceListVersion.version}`,
      sourceVersionId: item.priceListVersion.id,
      calculatedAt: item.calculatedAt,
      minimumPrice: Number(item.minimumPrice),
      normalPrice: Number(item.normalPrice),
      pisRate: Number(item.pisRate ?? 0),
      cofinsRate: Number(item.cofinsRate ?? 0),
      icmsRate: Number(item.icmsRate ?? 0),
      ipiRate: Number(item.ipiRate ?? 0),
      calculationId: item.calculationId,
      quantity: 1,
      image: item.image ?? null,
    };
  }
  card.append(photo, badge, code, description);
  const hint = document.createElement('div');
  hint.className = 'order-card-hint';
  hint.textContent =
    item.kind === 'STANDALONE_PRODUCT'
      ? 'Clique em um valor para adicionar ao pedido'
      : 'Clique para adicionar ao pedido';
  card.append(source);
  if (selectedCustomer) card.append(lastSale);
  card.append(prices);
  card.append(hint);
  const add = (): void => {
    if (canAdd) addToCart({ ...cartItem });
  };
  card.addEventListener('click', add);
  card.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    add();
  });
  return card;
}

function normalizedText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function drawerCategory(item: CatalogItem): 'KIT' | 'VALVE' | 'ITEM' {
  if (item.kind === 'KIT') return 'KIT';
  return /\bvalvul/.test(normalizedText(`${item.code} ${item.description}`)) ? 'VALVE' : 'ITEM';
}

function renderDrawerCatalog(): void {
  const container = element<HTMLElement>('#order-drawer-list');
  const search = normalizedText(element<HTMLInputElement>('#order-drawer-search').value.trim());
  const items = visibleCatalogItems.filter((item) => {
    const matchesFilter = drawerFilter === 'ALL' || drawerCategory(item) === drawerFilter;
    const haystack = normalizedText(
      `${item.code} ${item.description} ${item.kind === 'STANDALONE_PRODUCT' ? item.reference : ''}`,
    );
    return matchesFilter && (!search || haystack.includes(search));
  });
  clear(container);
  if (!items.length) {
    container.append(state('Nenhum item encontrado com esses filtros.'));
    return;
  }
  for (const item of items) container.append(catalogCard(item));
}

function setDrawerOpen(open: boolean): void {
  const drawer = element<HTMLElement>('#order-drawer');
  element<HTMLElement>('#order-drawer-overlay').classList.toggle('open', open);
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  if (open) {
    renderDrawerCatalog();
    window.requestAnimationFrame(() => element<HTMLInputElement>('#order-drawer-search').focus());
  }
}

function setVisibleCatalogItems(items: CatalogItem[]): void {
  visibleCatalogItems = items;
  if (element<HTMLElement>('#order-drawer').classList.contains('open')) renderDrawerCatalog();
}

async function loadSavedCatalog(customerId?: string): Promise<void> {
  const sequence = ++catalogSequence;
  const container = element<HTMLElement>('#order-drawer-list');
  clear(container);
  if (!canViewPrices()) {
    setVisibleCatalogItems([]);
    container.append(state('Você não possui permissão para visualizar preços e itens.'));
    return;
  }
  container.append(state('Carregando kits e itens unitários salvos…'));
  try {
    const response = await loadSavedOrderCatalog({
      ...(customerId ? { customerId } : {}),
      search: element<HTMLInputElement>('#order-drawer-search').value.trim(),
      page: catalogPage,
      pageSize: 12,
    });
    if (sequence !== catalogSequence) return;
    const items: CatalogItem[] = [...response.data.kits];
    setVisibleCatalogItems(items);
    renderDrawerCatalog();
    void refreshDrawerLastSalePrices(items, sequence);
    catalogPages = Math.max(
      response.pagination.calculatedProductTotalPages,
      response.pagination.kitTotalPages ?? 1,
    );
    element<HTMLElement>('#order-catalog-count').textContent =
      `${response.pagination.kitTotal + response.pagination.calculatedProductTotal} itens disponíveis`;
    const pagination = element<HTMLElement>('#order-pagination');
    pagination.hidden = catalogPages <= 1;
    element<HTMLElement>('#order-page-label').textContent =
      `Página ${catalogPage} de ${catalogPages}`;
    element<HTMLButtonElement>('#order-page-prev').disabled = catalogPage <= 1;
    element<HTMLButtonElement>('#order-page-next').disabled = catalogPage >= catalogPages;
  } catch (error) {
    if (sequence !== catalogSequence) return;
    setVisibleCatalogItems([]);
    clear(container);
    container.append(state(apiMessage(error, 'Não foi possível carregar os itens salvos.')));
  }
}

function loadVisibleCatalog(): Promise<void> {
  return loadCatalog();
}

async function loadCatalog(): Promise<void> {
  const sequence = ++catalogSequence;
  const container = element<HTMLElement>('#order-drawer-list');
  clear(container);
  if (!canViewPrices()) {
    setVisibleCatalogItems([]);
    container.append(state('Você não possui permissão para visualizar preços e itens.'));
    return;
  }
  container.append(state('Carregando produtos e kits compatíveis…'));
  try {
    const response = await loadOrderCatalog({
      ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
      search: element<HTMLInputElement>('#order-drawer-search').value.trim(),
      page: catalogPage,
      pageSize: 12,
    });
    if (sequence !== catalogSequence) return;
    const items: CatalogItem[] = [...response.data.kits, ...response.data.products];
    setVisibleCatalogItems(items);
    renderDrawerCatalog();
    void refreshDrawerLastSalePrices(items, sequence);
    catalogPages = Math.max(
      response.pagination.productTotalPages,
      response.pagination.kitTotalPages,
    );
    element<HTMLElement>('#order-catalog-count').textContent =
      `${response.pagination.kitTotal + response.pagination.productTotal} itens disponíveis`;
    const pagination = element<HTMLElement>('#order-pagination');
    pagination.hidden = catalogPages <= 1;
    element<HTMLElement>('#order-page-label').textContent =
      `Página ${catalogPage} de ${catalogPages}`;
    element<HTMLButtonElement>('#order-page-prev').disabled = catalogPage <= 1;
    element<HTMLButtonElement>('#order-page-next').disabled = catalogPage >= catalogPages;
  } catch (error) {
    if (sequence !== catalogSequence) return;
    setVisibleCatalogItems([]);
    clear(container);
    container.append(state(apiMessage(error, 'Não foi possível carregar o catálogo.')));
  }
}

function renderCart(): void {
  const container = element<HTMLElement>('#pedidoItems');
  clear(container);
  if (!cart.length) {
    const empty = document.createElement('div');
    empty.className = 'order-empty';
    empty.textContent = 'Nenhum item adicionado.';
    container.append(empty);
  }
  for (const item of cart) {
    const row = document.createElement('div');
    row.className = 'order-cart-row';
    const violation = quotedViolations.find(
      (candidate) =>
        candidate.code === item.code && candidate.priceListVersionId === item.sourceVersionId,
    );
    row.classList.toggle('has-exception', Boolean(violation));
    const top = document.createElement('div');
    top.className = 'order-cart-top';
    const badge = document.createElement('span');
    badge.className = `order-kind ${item.kind === 'KIT' ? 'kit' : 'product'}`;
    badge.textContent = item.kind === 'KIT' ? 'Kit' : 'Produto avulso';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-ghost btn-sm';
    remove.textContent = 'Remover';
    remove.addEventListener('click', () => {
      cart = cart.filter(({ key }) => key !== item.key);
      if (pendingCalculation?.id === item.calculationId) {
        pendingCalculation = null;
      }
      revalidateAfterCartChange();
    });
    top.append(badge, remove);
    const itemSummary = document.createElement('div');
    itemSummary.className = 'order-cart-summary';
    itemSummary.append(
      createMediaImage({
        image: item.image,
        entityLabel: item.kind === 'KIT' ? 'Kit' : 'Produto',
        code: item.code,
        description: descriptionWithoutUser(item.description),
        width: 72,
        height: 54,
        expandable: true,
      }),
    );
    const itemCopy = document.createElement('div');
    itemCopy.className = 'order-cart-summary__copy';
    const description = document.createElement('div');
    description.className = 'order-cart-desc';
    description.textContent = `${item.code} · ${descriptionWithoutUser(item.description)}`;
    const source = document.createElement('div');
    source.className = 'order-source';
    source.append(
      `${item.source}${item.calculatedAt ? ` · calculado em ${date(item.calculatedAt)}` : ''}`,
    );
    const lastOrderPrice = document.createElement('span');
    lastOrderPrice.className = 'order-cart-last-price';
    lastOrderPrice.textContent = !selectedCustomer
      ? ''
      : lastSalePricesFailed
        ? ' · último pedido indisponível'
        : item.lastOrderPrice === undefined
          ? ' · consultando último pedido…'
          : item.lastOrderPrice
            ? ` · último pedido ${money(item.lastOrderPrice.unitPrice)}`
            : ' · ainda não vendido para este cliente';
    if (item.lastOrderPrice) {
      lastOrderPrice.title = `${item.lastOrderPrice.orderNumber} · ${date(item.lastOrderPrice.orderedAt)}`;
    }
    source.append(lastOrderPrice);
    if (item.minimumPrice !== undefined && item.normalPrice !== undefined) {
      const referencePrices = document.createElement('span');
      referencePrices.className = 'order-cart-reference-prices reference-price';
      if (item.kind === 'STANDALONE_PRODUCT') {
        const selected = document.createElement('span');
        selected.className = 'order-cart-price-minimum';
        selected.textContent = `Mínimo da faixa selecionada: ${money(item.minimumPrice)} · ${item.priceListName ?? 'lista selecionada'} · ${compactRangeLabel(item.minimumOrderQuantity ?? null, item.maximumOrderQuantity ?? null, '')} · lista v${item.priceListVersion ?? 'atual'}`;
        referencePrices.append(selected);
      }
      if (item.priceRanges?.length) {
        for (const range of item.priceRanges) {
          const priceRange = document.createElement('span');
          priceRange.className = 'order-cart-price-range';
          const list = document.createElement('strong');
          list.textContent = range.list;
          priceRange.append(
            list,
            ` · Mínimo ${money(range.minimumPrice)} · Máximo ${money(range.maximumPrice)} · PIS ${percentage(range.pisRate)} · Cofins ${percentage(range.cofinsRate)} · ICMS ${percentage(range.icmsRate)} · IPI ${percentage(range.ipiRate)}`,
          );
          referencePrices.append(priceRange);
        }
      } else if (item.kind !== 'STANDALONE_PRODUCT') {
        const minimum = document.createElement('span');
        minimum.className = 'order-cart-price-minimum';
        minimum.textContent = `Mínimo ${money(item.minimumPrice)}`;
        const normal = document.createElement('span');
        normal.className = 'order-cart-price-normal';
        normal.textContent = `Máximo ${money(item.normalPrice)}`;
        referencePrices.append(minimum, normal);
      }
      source.append(referencePrices);
    }
    if (violation) {
      const exception = document.createElement('div');
      exception.className = 'order-cart-exception';
      exception.textContent = `Exceção de preço: mínimo ${money(violation.minimumUnitPrice)}, solicitado ${money(violation.negotiatedUnitPrice)}, diferença total ${money(violation.totalDifference)} (${percentage(violation.differencePercentage)}).`;
      source.append(exception);
    }
    if (item.ipiRate !== undefined && item.icmsRate !== undefined) {
      const tax = document.createElement('span');
      tax.className = 'order-cart-tax';
      tax.textContent = `Impostos da lista selecionada: PIS ${percentage(item.pisRate ?? 0)} · Cofins ${percentage(item.cofinsRate ?? 0)} · ICMS ${percentage(item.icmsRate)} · IPI ${percentage(item.ipiRate)}`;
      source.append(tax);
    }
    const controls = document.createElement('div');
    controls.className = 'order-cart-controls';
    controls.classList.add('has-tax');
    const quantityField = document.createElement('div');
    quantityField.className = 'order-cart-field';
    const quantityLabel = document.createElement('label');
    quantityLabel.textContent = 'Quantidade';
    const quantity = document.createElement('input');
    quantity.className = 'inp';
    quantity.type = 'number';
    quantity.min = '1';
    quantity.step = '1';
    quantity.value = String(item.quantity);
    quantity.setAttribute('aria-label', `Quantidade de ${item.code}`);
    quantity.addEventListener('change', () => {
      item.quantity = Math.max(1, Math.trunc(Number(quantity.value) || 1));
      revalidateAfterCartChange();
    });
    quantityField.append(quantityLabel, quantity);
    const priceField = document.createElement('div');
    priceField.className = 'order-cart-field';
    const priceLabel = document.createElement('label');
    priceLabel.textContent = `Preço-base unitário · ref. ${money(item.referencePrice)}`;
    const price = document.createElement('input');
    price.className = 'inp';
    price.type = 'text';
    price.inputMode = 'decimal';
    price.value = item.price.toFixed(2).replace('.', ',');
    price.setAttribute('aria-label', `Preço unitário de ${item.code}`);
    price.disabled = !canOverridePrices();
    if (!canOverridePrices())
      price.title = 'Seu usuário não possui permissão para negociar o preço.';
    price.addEventListener('input', () => {
      invalidateQuote();
      const parsed = parseMoney(price.value);
      if (parsed === null) return;
      item.price = parsed;
      item.priceEdited = Math.abs(item.price - item.referencePrice) > 0.0001;
      subtotal.textContent = `Impostos ${money(orderTaxUnitAmount(item))} · Unitário final ${money(orderUnitAmount(item))} · Total ${money(orderLineAmount(item))}`;
      updateCartSummary();
      scheduleDraftAutosave();
    });
    price.addEventListener('change', () => {
      const parsed = parseMoney(price.value);
      item.price = parsed ?? item.referencePrice;
      item.priceEdited = Math.abs(item.price - item.referencePrice) > 0.0001;
      renderCart();
      scheduleDraftAutosave();
    });
    priceField.append(priceLabel, price);
    const taxField = document.createElement('div');
    taxField.className = 'order-cart-field order-cart-tax-field';
    const taxLabel = document.createElement('label');
    taxLabel.textContent = 'Somar impostos ao preço-base';
    const taxOptions = document.createElement('div');
    taxOptions.className = 'order-cart-tax-options';
    taxOptions.setAttribute('role', 'group');
    taxOptions.setAttribute('aria-label', 'Somar impostos ao preço-base');
    taxField.append(taxLabel, taxOptions);
    {
      const taxes = ensureTaxes(item);
      const labels: Array<[keyof typeof taxes, string]> = [
        ['pis', 'PIS'],
        ['cofins', 'Cofins'],
        ['icms', 'ICMS'],
        ['ipi', 'IPI'],
      ];
      for (const [code, caption] of labels) {
        const option = document.createElement('label');
        option.className = 'order-cart-tax-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = taxes[code].selected;
        checkbox.setAttribute(
          'aria-label',
          `Aplicar ${caption} de ${percentage(taxes[code].rate)} em ${item.code}`,
        );
        checkbox.addEventListener('change', () => {
          taxes[code].selected = checkbox.checked;
          invalidateQuote();
          renderCart();
          scheduleDraftAutosave();
        });
        option.append(checkbox, `${caption} ${percentage(taxes[code].rate)}`);
        taxOptions.append(option);
      }
    }
    const subtotal = document.createElement('div');
    subtotal.className = 'order-cart-subtotal';
    subtotal.setAttribute('aria-label', `Total do item ${item.code}`);
    subtotal.textContent = `Impostos ${money(orderTaxUnitAmount(item))} · Unitário final ${money(orderUnitAmount(item))} · Total ${money(orderLineAmount(item))}`;
    controls.append(quantityField, priceField);
    controls.append(taxField);
    controls.append(subtotal);
    itemCopy.append(description, source);
    itemSummary.append(itemCopy);
    row.append(top, itemSummary, controls);
    container.append(row);
  }
  updateCartSummary();
}

function parseMoney(value: string): number | null {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function updateCartSummary(): void {
  const quantity = totalQuantity();
  const total = orderAmount(cart);
  element<HTMLElement>('#pedidoCartBadge').textContent = String(quantity);
  element<HTMLElement>('#pedidoTotalQty').textContent =
    `${quantity} ${quantity === 1 ? 'item' : 'itens'}`;
  element<HTMLElement>('#pedidoSubNor').textContent = money(total);
  const review = element<HTMLButtonElement>('#order-review');
  const apparentException = cart.some(
    (item) => item.minimumPrice !== undefined && item.price < item.minimumPrice,
  );
  review.textContent =
    selectedApproval?.status === 'PENDING'
      ? 'Aguardando aprovação'
      : apparentException && selectedApproval?.status !== 'APPROVED'
        ? 'Solicitar aprovação'
        : 'Gerar pedido';
  review.disabled = !selectedCustomer || !cart.length || selectedApproval?.status === 'PENDING';
}

async function reviewOrder(): Promise<void> {
  if (!selectedCustomer || !cart.length) return;
  const input = orderInput();
  if (!input) return;
  const review = element<HTMLButtonElement>('#order-review');
  review.disabled = true;
  setQuoteFeedback('Validando cliente, lista, versões e preços no servidor…');
  try {
    const response = await quoteOrder(input);
    quotedViolations = response.data.approval?.violations ?? [];
    response.data.lines.forEach((quoted, index) => {
      const item = cart[index];
      if (!item) return;
      item.referencePrice = Number(quoted.referenceUnitPrice ?? quoted.unitPrice);
      item.price = Number(quoted.negotiatedUnitPrice ?? quoted.unitPrice);
      item.priceEdited = Math.abs(item.price - item.referencePrice) > 0.0001;
      item.sourceVersionId = quoted.priceListVersion.id;
      item.priceListName = quoted.priceList.name;
      item.priceListVersion = quoted.priceListVersion.version;
      item.minimumOrderQuantity = quoted.priceList.minimumOrderQuantity ?? null;
      item.maximumOrderQuantity = quoted.priceList.maximumOrderQuantity ?? null;
      item.minimumPrice = Number(quoted.minimumReferencePrice ?? item.minimumPrice ?? 0);
      item.image = quoted.image;
      {
        item.pisRate = Number(quoted.pisRate ?? 0);
        item.cofinsRate = Number(quoted.cofinsRate ?? 0);
        item.ipiRate = Number(quoted.ipiRate ?? 0);
        item.icmsRate = Number(quoted.icmsRate ?? 0);
        if (quoted.taxes) {
          item.taxes = {
            pis: { selected: quoted.taxes.pis.selected, rate: Number(quoted.taxes.pis.rate) },
            cofins: {
              selected: quoted.taxes.cofins.selected,
              rate: Number(quoted.taxes.cofins.rate),
            },
            icms: { selected: quoted.taxes.icms.selected, rate: Number(quoted.taxes.icms.rate) },
            ipi: { selected: quoted.taxes.ipi.selected, rate: Number(quoted.taxes.ipi.rate) },
          };
        }
      }
      item.source =
        quoted.kind === 'STANDALONE_PRODUCT'
          ? `${quoted.priceList.name} · lista v${quoted.priceListVersion.version}`
          : `${quoted.priceList.name} · cálculo v${quoted.calculationVersion} · lista v${quoted.priceListVersion.version}`;
    });
    renderCart();
    if (response.data.approval?.required) {
      if (selectedApproval?.status === 'APPROVED') {
        openOrderReview(response.data);
        setQuoteFeedback('Aprovação válida encontrada. Revise a nova cotação antes de confirmar.');
      } else if (selectedApproval?.status === 'PENDING') {
        setQuoteFeedback('Esta solicitação ainda aguarda análise. Nenhum pedido foi criado.');
      } else {
        openApprovalModal();
        setQuoteFeedback('O carrinho possui preço abaixo do mínimo e precisa de aprovação.');
      }
    } else {
      selectedApproval = null;
      window.sessionStorage.removeItem('order-price-approval-id');
      openOrderReview(response.data);
      setQuoteFeedback('Cotação validada. Revise os dados antes da confirmação final.');
    }
  } catch (error) {
    const details =
      error instanceof ApiError ? Object.values(error.fieldErrors).flat().join(' ') : '';
    setQuoteFeedback(
      `${apiMessage(error, 'Não foi possível validar o carrinho.')}${details ? ` ${details}` : ''}`,
      true,
    );
    if (
      error instanceof ApiError &&
      ['ORDER_PRICE_APPROVAL_EXPIRED', 'ORDER_PRICE_APPROVAL_CONTENT_MISMATCH'].includes(error.code)
    ) {
      selectedApproval = null;
      window.sessionStorage.removeItem('order-price-approval-id');
    }
  } finally {
    updateCartSummary();
  }
}

export function initializeOrdersPage(): void {
  if (initialized) return;
  initialized = true;
  createOrderReviewModal();
  createApprovalModal();
  element<HTMLButtonElement>('#order-back').addEventListener('click', backToOrderOrigin);
  const picker = element<HTMLElement>('#pedidoClientePicker');
  const trigger = element<HTMLButtonElement>('#pedido-client-trigger');
  trigger.addEventListener('click', () => setPickerOpen(!picker.classList.contains('open')));
  element<HTMLButtonElement>('#pedido-client-clear').addEventListener('click', () => {
    void clearSelectedCustomer();
  });
  element<HTMLButtonElement>('#order-customer-add').addEventListener('click', () => {
    void openPreRegistration();
  });
  element<HTMLFormElement>('#order-customer-pre-form').addEventListener('submit', (event) => {
    void submitPreRegistration(event);
  });
  for (const selector of ['#order-customer-pre-close', '#order-customer-pre-cancel']) {
    element<HTMLButtonElement>(selector).addEventListener('click', closePreRegistration);
  }
  element<HTMLElement>('#order-customer-pre-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closePreRegistration();
  });
  element<HTMLInputElement>('#pedidoClienteSearch').addEventListener('input', () => {
    window.clearTimeout(customerTimer);
    customerTimer = window.setTimeout(() => void loadCustomers(), 250);
  });
  element<HTMLButtonElement>('#order-reload-lists').addEventListener(
    'click',
    () => void loadPriceLists(),
  );
  element<HTMLButtonElement>('#order-page-prev').addEventListener('click', () => {
    if (catalogPage > 1) {
      catalogPage -= 1;
      void loadVisibleCatalog();
    }
  });
  element<HTMLButtonElement>('#order-page-next').addEventListener('click', () => {
    if (catalogPage < catalogPages) {
      catalogPage += 1;
      void loadVisibleCatalog();
    }
  });
  element<HTMLButtonElement>('#order-review').addEventListener('click', () => void reviewOrder());
  element<HTMLButtonElement>('#order-approval-submit').addEventListener(
    'click',
    () => void submitApprovalRequest(),
  );
  for (const selector of ['#order-approval-close', '#order-approval-cancel']) {
    element<HTMLButtonElement>(selector).addEventListener('click', () => closeApprovalModal());
  }
  element<HTMLElement>('#order-approval-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeApprovalModal();
  });
  element<HTMLButtonElement>('#order-confirm').addEventListener('click', () => void confirmOrder());
  for (const selector of ['#order-review-close', '#order-review-back']) {
    element<HTMLButtonElement>(selector).addEventListener('click', () => closeOrderReview());
  }
  element<HTMLElement>('#order-review-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeOrderReview();
  });
  element<HTMLTextAreaElement>('#pedidoObs').addEventListener('input', () => {
    invalidateQuote();
    scheduleDraftAutosave();
  });
  element<HTMLButtonElement>('#order-drawer-open').addEventListener('click', () => {
    drawerFilter = 'ALL';
    catalogPage = 1;
    element<HTMLInputElement>('#order-drawer-search').value = '';
    element<HTMLElement>('#order-drawer-filters')
      .querySelectorAll<HTMLButtonElement>('[data-order-filter]')
      .forEach((button) => button.classList.toggle('on', button.dataset.orderFilter === 'ALL'));
    setDrawerOpen(true);
    void loadVisibleCatalog();
  });
  element<HTMLButtonElement>('#order-drawer-close').addEventListener('click', () =>
    setDrawerOpen(false),
  );
  element<HTMLElement>('#order-drawer-overlay').addEventListener('click', () =>
    setDrawerOpen(false),
  );
  element<HTMLInputElement>('#order-drawer-search').addEventListener('input', () => {
    window.clearTimeout(catalogTimer);
    catalogTimer = window.setTimeout(() => {
      catalogPage = 1;
      void loadVisibleCatalog();
    }, 250);
  });
  element<HTMLElement>('#order-drawer-filters').addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-order-filter]');
    if (!button) return;
    drawerFilter = button.dataset.orderFilter as typeof drawerFilter;
    element<HTMLElement>('#order-drawer-filters')
      .querySelectorAll<HTMLButtonElement>('[data-order-filter]')
      .forEach((option) => option.classList.toggle('on', option === button));
    renderDrawerCatalog();
  });
  document.addEventListener('click', (event) => {
    if (!picker.contains(event.target as Node)) setPickerOpen(false);
  });
  window.addEventListener('fluair:approval-cancelled', (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (!id || selectedApproval?.id !== id) return;
    selectedApproval = null;
    window.sessionStorage.removeItem('order-price-approval-id');
    renderCart();
    setQuoteFeedback('Solicitação cancelada.');
  });
  window.addEventListener('fluair:approval-resume', (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (id) void loadApprovalIntoCart(id);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picker.classList.contains('open')) setPickerOpen(false);
    if (
      event.key === 'Escape' &&
      element<HTMLElement>('#order-customer-pre-modal').classList.contains('open')
    )
      closePreRegistration();
    if (event.key === 'Escape') setDrawerOpen(false);
    const approvalModal = element<HTMLElement>('#order-approval-modal');
    if (event.key === 'Escape' && approvalModal.classList.contains('open')) {
      event.preventDefault();
      closeApprovalModal();
    }
    const reviewModal = element<HTMLElement>('#order-review-modal');
    if (event.key === 'Escape' && reviewModal.classList.contains('open')) {
      event.preventDefault();
      closeOrderReview();
    }
    if (event.key === 'Tab' && reviewModal.classList.contains('open')) {
      const focusable = [
        ...reviewModal.querySelectorAll<HTMLElement>('button:not([disabled])'),
      ].filter((node) => !node.hidden);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'Tab' && approvalModal.classList.contains('open')) {
      const focusable = [
        ...approvalModal.querySelectorAll<HTMLElement>(
          'button:not([disabled]),textarea:not([disabled])',
        ),
      ].filter((node) => !node.hidden);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  syncSelectedCustomer();
  renderCart();
}

export function showOrdersPage(user: AuthenticatedUser): void {
  const userChanged = currentUser?.id !== user.id;
  currentUser = user;
  if (userChanged) {
    selectedCustomer = null;
    selectedPriceList = null;
    cart = [];
    savedDrafts = [];
    selectedApproval = null;
    pendingCalculation = null;
    quotedViolations = [];
    window.sessionStorage.removeItem('order-price-approval-id');
    element<HTMLTextAreaElement>('#pedidoObs').value = '';
    syncSelectedCustomer();
    renderCart();
    renderSavedDrafts();
  }
  element<HTMLButtonElement>('#order-customer-add').hidden = !canManageCustomers();
  syncBackButton();
  setPickerOpen(false);
  setDrawerOpen(false);
  catalogPage = 1;
  void loadVisibleCatalog();
  element<HTMLButtonElement>('#order-reload-lists').hidden = !selectedCustomer;
  void loadCustomers();
  void loadSavedDraft();
  const query = new URLSearchParams(window.location.search);
  const approvalId = query.get('aprovacao');
  const calculationId = query.get('calculo');
  const customerId = query.get('cliente');
  if (approvalId) void loadApprovalIntoCart(approvalId);
  void loadOrderContext(calculationId, customerId);
}
