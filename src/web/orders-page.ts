import { ROLE_CODES, type AuthenticatedUser } from '../shared/auth.js';
import type { Customer, CustomerClass, CustomerSegment } from '../shared/customers.js';
import type { CalculationDetail } from '../shared/pricing.js';
import type { NullableImageReference } from '../shared/media.js';
import type {
  EligibleOrderPriceList,
  OrderKitCatalogItem,
  OrderStandaloneCatalogItem,
} from '../shared/orders.js';
import { orderTotalQuantity } from '../shared/order-quantity.js';
import { orderAmount, orderLineAmount } from '../shared/order-money.js';
import { descriptionWithoutUser } from './display-text.js';
import { createMediaImage } from './components/media-image.js';
import { ApiError } from './services/api.js';
import { getCalculation } from './services/calculations-api.js';
import {
  getCustomer,
  listCustomerClassifications,
  listCustomers,
  preRegisterCustomer,
} from './services/customers-api.js';
import {
  listEligibleOrderPriceLists,
  loadOrderCatalog,
  loadSavedOrderCatalog,
  quoteOrder,
} from './services/orders-api.js';

type CatalogItem = OrderStandaloneCatalogItem | OrderKitCatalogItem;

type CartItem = {
  key: string;
  kind: 'KIT' | 'STANDALONE_PRODUCT';
  code: string;
  description: string;
  price: number;
  taxRate: number;
  referencePrice: number;
  priceEdited: boolean;
  priceReference: 'MINIMUM' | 'NORMAL' | 'UNIT';
  source: string;
  sourceVersionId: string;
  calculatedAt?: string;
  minimumPrice?: number;
  normalPrice?: number;
  priceRanges?: Array<{
    list: string;
    minimumPrice: number;
    maximumPrice: number;
    ipiRate: number;
    icmsRate: number;
  }>;
  ipiRate?: number;
  icmsRate?: number;
  calculationId?: string;
  quantity: number;
  image: NullableImageReference;
};

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
let customerTimer: number | undefined;
let catalogTimer: number | undefined;
let customerSequence = 0;
let priceListSequence = 0;
let catalogSequence = 0;
let catalogPage = 1;
let catalogPages = 1;
let initialized = false;
let pendingCalculation: CalculationDetail | null = null;
let visibleCatalogItems: CatalogItem[] = [];
let drawerFilter: 'ALL' | 'KIT' | 'VALVE' | 'ITEM' = 'ALL';

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
    key: `kit:${detail.id}:MINIMUM`,
    kind: 'KIT',
    code: detail.kitCode,
    description: descriptionWithoutUser(detail.kitDescription),
    price: Number(detail.minimumTotal),
    taxRate: 0,
    referencePrice: Number(detail.minimumTotal),
    priceEdited: false,
    priceReference: 'MINIMUM',
    source: `${detail.priceList.name} · cálculo v${detail.version} · lista v${detail.priceListVersion.version}`,
    sourceVersionId: detail.priceListVersion.id,
    calculatedAt: detail.createdAt,
    minimumPrice: Number(detail.minimumTotal),
    normalPrice: Number(detail.normalTotal),
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
    if (selectedCustomer) void loadCatalog();
  } catch (error) {
    pendingCalculation = null;
    setRangeWarning(apiMessage(error, 'Não foi possível adicionar o kit ao pedido.'));
  }
}

async function loadPendingCustomer(id: string): Promise<void> {
  try {
    const customer = (await getCustomer(id)).data.customer;
    if (!customer.active) throw new Error('O cliente selecionado estÃ¡ desativado.');
    selectedCustomer = customer;
    element<HTMLTextAreaElement>('#pedidoObs').value = customer.orderNote ?? '';
    syncSelectedCustomer();
    renderCustomers(customers.length);
    renderCart();
    await loadCatalog();
  } catch (error) {
    setRangeWarning(apiMessage(error, 'NÃ£o foi possÃ­vel adicionar o cliente ao pedido.'));
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

function clearSelectedCustomer(): void {
  if (!selectedCustomer) return;
  selectedCustomer = null;
  element<HTMLTextAreaElement>('#pedidoObs').value = '';
  element<HTMLInputElement>('#pedidoClienteSearch').value = '';
  element<HTMLButtonElement>('#order-reload-lists').hidden = true;
  setPickerOpen(false);
  syncSelectedCustomer();
  renderCustomers(customers.length);
  setRangeWarning();
  invalidateQuote();
  renderCart();
  void loadCatalog();
  element<HTMLButtonElement>('#pedido-client-trigger').focus();
}

function selectCustomer(customer: Customer): void {
  const hadPreviousCustomer = Boolean(selectedCustomer);
  const changed = selectedCustomer?.id !== customer.id;
  selectedCustomer = customer;
  element<HTMLTextAreaElement>('#pedidoObs').value = customer.orderNote ?? '';
  element<HTMLInputElement>('#pedidoClienteSearch').value = '';
  syncSelectedCustomer();
  renderCustomers(customers.length);
  setPickerOpen(false);
  if (changed) {
    invalidateQuote();
    cart = [];
    applyPendingCalculation();
    setRangeWarning(
      hadPreviousCustomer
        ? 'Cliente alterado. Os itens e os preços anteriores foram invalidados.'
        : 'Cliente selecionado. O catálogo agora mostra apenas ofertas compatíveis.',
    );
    renderCart();
    void loadCatalog();
  }
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
  const tag = document.createElement('div');
  tag.className = 'cliente-option-tag';
  tag.textContent = customer.customerSegment?.name ?? customer.segment ?? 'Sem segmento';
  button.append(code, main, tag);
  button.addEventListener('click', () => selectCustomer(customer));
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
    selectCustomer(customer);
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
      referencePrice: Number(range?.maximumPrice ?? item.unitPrice),
      priceEdited: false,
      priceReference: 'UNIT',
      source: range
        ? `${range.priceList.name} · lista v${range.priceListVersion}`
        : `${compatibleLists} · referência pela maior oferta`,
      sourceVersionId: range?.priceListVersionId ?? item.priceListVersionId,
      minimumPrice: Number(item.minimumPrice),
      normalPrice: Number(item.maximumPrice),
      priceRanges: cartRanges,
      ipiRate: Number(range?.ipiRate ?? item.ipiRate ?? 0),
      icmsRate: Number(range?.icmsRate ?? item.icmsRate ?? 0),
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
      price.className = 'order-card-price order-card-price-range';
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
      taxRate: 0,
      referencePrice: Number(item.normalPrice),
      priceEdited: false,
      priceReference: 'NORMAL',
      source: `${item.priceList.name} · cálculo v${item.calculationVersion} · lista v${item.priceListVersion.version}`,
      sourceVersionId: item.priceListVersion.id,
      calculatedAt: item.calculatedAt,
      minimumPrice: Number(item.minimumPrice),
      normalPrice: Number(item.normalPrice),
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
    if (item.minimumPrice !== undefined && item.normalPrice !== undefined) {
      const referencePrices = document.createElement('span');
      referencePrices.className = 'order-cart-reference-prices reference-price';
      if (item.priceRanges?.length) {
        for (const range of item.priceRanges) {
          const priceRange = document.createElement('span');
          priceRange.className = 'order-cart-price-range';
          const list = document.createElement('strong');
          list.textContent = range.list;
          priceRange.append(
            list,
            ` · Mínimo ${money(range.minimumPrice)} · Máximo ${money(range.maximumPrice)} · IPI ${percentage(range.ipiRate)} · ICMS ${percentage(range.icmsRate)}`,
          );
          referencePrices.append(priceRange);
        }
      } else {
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
    if (
      item.kind === 'STANDALONE_PRODUCT' &&
      item.ipiRate !== undefined &&
      item.icmsRate !== undefined
    ) {
      const tax = document.createElement('span');
      tax.className = 'order-cart-tax';
      tax.textContent = `Impostos da lista selecionada: IPI ${percentage(item.ipiRate)} · ICMS ${percentage(item.icmsRate)}`;
      source.append(tax);
    }
    const controls = document.createElement('div');
    controls.className = 'order-cart-controls';
    controls.classList.toggle('has-tax', item.kind === 'STANDALONE_PRODUCT');
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
    priceLabel.textContent = `Preço unitário · ref. ${money(item.referencePrice)}`;
    const price = document.createElement('input');
    price.className = 'inp';
    price.type = 'text';
    price.inputMode = 'decimal';
    price.value = item.price.toFixed(2).replace('.', ',');
    price.setAttribute('aria-label', `Preço unitário de ${item.code}`);
    price.addEventListener('input', () => {
      const parsed = parseMoney(price.value);
      if (parsed === null) return;
      item.price = parsed;
      item.priceEdited = Math.abs(item.price - item.referencePrice) > 0.0001;
      subtotal.textContent = money(orderLineAmount(item));
      updateCartSummary();
    });
    price.addEventListener('change', () => {
      const parsed = parseMoney(price.value);
      item.price = parsed ?? item.referencePrice;
      item.priceEdited = Math.abs(item.price - item.referencePrice) > 0.0001;
      renderCart();
    });
    priceField.append(priceLabel, price);
    const taxField = document.createElement('div');
    taxField.className = 'order-cart-field order-cart-tax-field';
    const taxLabel = document.createElement('label');
    taxLabel.textContent = 'Imposto (%)';
    const tax = document.createElement('input');
    tax.className = 'inp';
    tax.type = 'number';
    tax.inputMode = 'decimal';
    tax.min = '0';
    tax.step = '0.01';
    tax.value = item.taxRate.toFixed(2);
    tax.setAttribute('aria-label', `Imposto percentual de ${item.code}`);
    tax.disabled = item.kind !== 'STANDALONE_PRODUCT';
    tax.addEventListener('input', () => {
      const parsed = parsePercentage(tax.value);
      if (parsed === null) return;
      item.taxRate = parsed;
    });
    tax.addEventListener('change', () => {
      item.taxRate = parsePercentage(tax.value) ?? 0;
      renderCart();
    });
    taxField.append(taxLabel, tax);
    const subtotal = document.createElement('div');
    subtotal.className = 'order-cart-subtotal';
    subtotal.setAttribute('aria-label', `Subtotal de ${item.code}, sem reaplicar o imposto`);
    subtotal.textContent = money(orderLineAmount(item));
    controls.append(quantityField, priceField);
    if (item.kind === 'STANDALONE_PRODUCT') controls.append(taxField);
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

function parsePercentage(value: string): number | null {
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function updateCartSummary(): void {
  const quantity = totalQuantity();
  const total = orderAmount(cart);
  element<HTMLElement>('#pedidoCartBadge').textContent = String(quantity);
  element<HTMLElement>('#pedidoTotalQty').textContent =
    `${quantity} ${quantity === 1 ? 'item' : 'itens'}`;
  element<HTMLElement>('#pedidoSubNor').textContent = money(total);
  element<HTMLButtonElement>('#order-review').disabled = !selectedCustomer || !cart.length;
}

async function reviewOrder(): Promise<void> {
  if (!selectedCustomer || !cart.length) return;
  const review = element<HTMLButtonElement>('#order-review');
  review.disabled = true;
  setQuoteFeedback('Validando cliente, lista, versões e preços no servidor…');
  try {
    const response = await quoteOrder({
      customerId: selectedCustomer.id,
      lines: cart.map((item) =>
        item.kind === 'STANDALONE_PRODUCT'
          ? {
              kind: item.kind,
              productCode: item.code,
              priceListVersionId: item.sourceVersionId,
              quantity: item.quantity,
            }
          : {
              kind: item.kind,
              calculationId: item.calculationId!,
              priceReference: item.priceReference as 'MINIMUM' | 'NORMAL',
              quantity: item.quantity,
            },
      ),
    });
    response.data.lines.forEach((quoted, index) => {
      const item = cart[index];
      if (!item) return;
      item.referencePrice = Number(quoted.unitPrice);
      if (!item.priceEdited) item.price = item.referencePrice;
      item.sourceVersionId = quoted.priceListVersion.id;
      item.image = quoted.image;
      if (quoted.kind === 'STANDALONE_PRODUCT') {
        item.ipiRate = Number(quoted.ipiRate ?? 0);
        item.icmsRate = Number(quoted.icmsRate ?? 0);
      }
      item.source =
        quoted.kind === 'STANDALONE_PRODUCT'
          ? `${quoted.priceList.name} · lista v${quoted.priceListVersion.version}`
          : `${quoted.priceList.name} · cálculo v${quoted.calculationVersion} · lista v${quoted.priceListVersion.version}`;
    });
    renderCart();
    const warning = response.data.warnings.length ? ` ${response.data.warnings.join(' ')}` : '';
    const negotiated = cart.some(({ priceEdited }) => priceEdited)
      ? ' Os preços informados manualmente foram preservados.'
      : '';
    const total = orderAmount(cart);
    setQuoteFeedback(
      `Pedido gerado. Cotação validada pelo servidor para ${response.data.totalQuantity} itens. Total ${money(total)}.${negotiated}${warning}`,
    );
  } catch (error) {
    const details =
      error instanceof ApiError ? Object.values(error.fieldErrors).flat().join(' ') : '';
    setQuoteFeedback(
      `${apiMessage(error, 'Não foi possível validar o carrinho.')}${details ? ` ${details}` : ''}`,
      true,
    );
  } finally {
    review.disabled = !selectedCustomer || !cart.length;
  }
}

export function initializeOrdersPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLButtonElement>('#order-back').addEventListener('click', backToOrderOrigin);
  const picker = element<HTMLElement>('#pedidoClientePicker');
  const trigger = element<HTMLButtonElement>('#pedido-client-trigger');
  trigger.addEventListener('click', () => setPickerOpen(!picker.classList.contains('open')));
  element<HTMLButtonElement>('#pedido-client-clear').addEventListener('click', () =>
    clearSelectedCustomer(),
  );
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picker.classList.contains('open')) setPickerOpen(false);
    if (
      event.key === 'Escape' &&
      element<HTMLElement>('#order-customer-pre-modal').classList.contains('open')
    )
      closePreRegistration();
    if (event.key === 'Escape') setDrawerOpen(false);
  });
  syncSelectedCustomer();
  renderCart();
}

export function showOrdersPage(user: AuthenticatedUser): void {
  currentUser = user;
  element<HTMLButtonElement>('#order-customer-add').hidden = !canManageCustomers();
  syncBackButton();
  setPickerOpen(false);
  setDrawerOpen(false);
  catalogPage = 1;
  void loadVisibleCatalog();
  element<HTMLButtonElement>('#order-reload-lists').hidden = !selectedCustomer;
  void loadCustomers();
  const query = new URLSearchParams(window.location.search);
  const calculationId = query.get('calculo');
  const customerId = query.get('cliente');
  if (calculationId && pendingCalculation?.id !== calculationId) {
    cart = [];
    selectedPriceList = null;
    renderCart();
    void loadPendingCalculation(calculationId);
  } else if (!calculationId) {
    pendingCalculation = null;
  }
  if (customerId && selectedCustomer?.id !== customerId) void loadPendingCustomer(customerId);
}
