import { ROLE_CODES, type AuthenticatedUser } from '../shared/auth.js';
import {
  legacyCustomerSegmentLabel,
  type Customer,
  type CustomerCalculationLink,
  type CustomerClass,
  type CustomerFilters,
  type CustomerSegment,
} from '../shared/customers.js';
import { ApiError } from './services/api.js';
import {
  createCustomer,
  exportCustomers,
  getCustomer,
  getCustomerCalculationLinks,
  listCustomerClassifications,
  listCustomers,
  setCustomerActive,
  updateCustomer,
  type CustomerInput,
  type CustomerQuery,
} from './services/customers-api.js';

let currentUser: AuthenticatedUser | null = null;
let customers: Customer[] = [];
let filters: CustomerFilters = { segments: [], sellers: [], representatives: [] };
let customerClasses: CustomerClass[] = [];
let customerSegments: CustomerSegment[] = [];
let page = 1;
let totalPages = 1;
let editingCustomerId: string | null = null;
let statusTarget: { id: string; active: boolean } | null = null;
let viewedCustomer: Customer | null = null;
let loadedLinksCustomerId: string | null = null;
let searchTimer: number | undefined;
let requestSequence = 0;
let initialized = false;

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function canManage(): boolean {
  return currentUser?.roleCode === ROLE_CODES.administrator;
}

function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove();
}

function apiMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}

function setFeedback(message: string, error = false): void {
  const target = element<HTMLElement>('#customers-feedback');
  target.textContent = message;
  target.hidden = !message;
  target.classList.toggle('is-error', error);
}

function setFormError(message: string): void {
  const target = element<HTMLElement>('#customer-form-error');
  target.textContent = message;
  target.hidden = !message;
}

function currentQuery(): CustomerQuery {
  const representative = element<HTMLSelectElement>('#customers-representative').value;
  return {
    search: element<HTMLInputElement>('#customers-search').value.trim(),
    customerClassId: element<HTMLSelectElement>('#customers-class').value,
    customerSegmentId: element<HTMLSelectElement>('#customers-segment').value,
    seller: element<HTMLSelectElement>('#customers-seller').value,
    ...(representative === '__direct__'
      ? { directOnly: true }
      : representative
        ? { representative }
        : {}),
    status: element<HTMLSelectElement>('#customers-status').value as NonNullable<
      CustomerQuery['status']
    >,
    page,
    pageSize: 25,
  };
}

function option(value: string, label = value): HTMLOptionElement {
  const result = document.createElement('option');
  result.value = value;
  result.textContent = label;
  return result;
}

function populateSelect(
  selector: string,
  values: string[],
  firstLabel: string,
  includeDirect = false,
): void {
  const select = element<HTMLSelectElement>(selector);
  const selected = select.value;
  clear(select);
  select.append(option('', firstLabel));
  if (includeDirect) select.append(option('__direct__', 'Sem representante (direto)'));
  for (const value of values) select.append(option(value));
  if ([...select.options].some((item) => item.value === selected)) select.value = selected;
}

function populateClassificationSelect(
  selector: string,
  values: Array<CustomerClass | CustomerSegment>,
  firstLabel: string,
): void {
  const select = element<HTMLSelectElement>(selector);
  const selected = select.value;
  clear(select);
  select.append(option('', firstLabel));
  for (const value of values) select.append(option(value.id, value.name));
  if ([...select.options].some((item) => item.value === selected)) select.value = selected;
}

function renderFilters(): void {
  populateClassificationSelect('#customers-class', customerClasses, 'Todas as classes');
  populateClassificationSelect('#customers-segment', customerSegments, 'Todos os segmentos');
  populateSelect('#customers-seller', filters.sellers, 'Todos os vendedores');
  populateSelect(
    '#customers-representative',
    filters.representatives,
    'Todos os representantes',
    true,
  );
}

function badge(text: string, className: string): HTMLSpanElement {
  const result = document.createElement('span');
  result.className = `tag ${className}`;
  result.textContent = text;
  return result;
}

function actionButton(label: string, className: string, action: () => void): HTMLButtonElement {
  const result = document.createElement('button');
  result.type = 'button';
  result.className = className;
  result.textContent = label;
  result.addEventListener('click', action);
  return result;
}

function valueOrDash(value: string | null): string {
  return value || '—';
}

function classificationBadge(value: CustomerClass | CustomerSegment | null): HTMLSpanElement {
  return value ? badge(value.name, 'tag-blue') : badge('Não classificado', 'tag-gray');
}

function optionalCellValue(cell: HTMLTableCellElement, value: string | null | undefined): void {
  if (value) {
    cell.textContent = value;
    return;
  }
  cell.classList.add('customer-empty-cell');
  const placeholder = document.createElement('span');
  placeholder.className = 'customer-empty-value';
  placeholder.textContent = '—';
  placeholder.title = 'Não informado';
  placeholder.setAttribute('aria-label', 'Não informado');
  cell.append(placeholder);
}

function renderCustomers(): void {
  const body = element<HTMLTableSectionElement>('#customers-body');
  clear(body);
  if (customers.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 11;
    cell.className = 'customers-empty';
    cell.textContent = 'Nenhum cliente encontrado com os filtros informados.';
    row.append(cell);
    body.append(row);
    return;
  }

  for (const customer of customers) {
    const row = document.createElement('tr');
    row.className = `customer-row${customer.active ? '' : ' customer-inactive'}`;

    const code = document.createElement('td');
    code.className = 'customer-code';
    code.dataset.label = 'Código';
    code.textContent = customer.code;
    const legalName = document.createElement('td');
    legalName.className = 'customer-name-cell';
    legalName.dataset.label = 'Razão social';
    const name = actionButton(customer.legalName, 'customer-name customer-name-link', () =>
      openCustomerDetails(customer),
    );
    const nameContent = document.createElement('div');
    nameContent.className = 'customer-name-content';
    const statusBadge = badge(
      customer.active ? 'Ativo' : 'Desativado',
      customer.active ? 'tag-green' : 'tag-red',
    );
    statusBadge.classList.add('customer-status-badge');
    nameContent.append(name, statusBadge);
    legalName.append(nameContent);
    const cnpj = document.createElement('td');
    cnpj.className = 'customer-tax-id';
    cnpj.dataset.label = 'CNPJ';
    optionalCellValue(cnpj, customer.cnpj ? formatCnpj(customer.cnpj) : null);
    const city = document.createElement('td');
    city.className = 'customer-city';
    city.dataset.label = 'Cidade';
    optionalCellValue(city, customer.city);
    const state = document.createElement('td');
    state.className = 'customer-state';
    state.dataset.label = 'UF';
    optionalCellValue(state, customer.state);
    const customerClass = document.createElement('td');
    customerClass.className = 'customer-classification';
    customerClass.dataset.label = 'Classe';
    customerClass.append(classificationBadge(customer.customerClass));
    const segment = document.createElement('td');
    segment.className = 'customer-classification';
    segment.dataset.label = 'Segmento';
    segment.append(classificationBadge(customer.customerSegment));
    const seller = document.createElement('td');
    seller.dataset.label = 'Vendedor';
    seller.textContent = valueOrDash(customer.seller);
    const representative = document.createElement('td');
    representative.dataset.label = 'Representante';
    representative.textContent = customer.representative || 'Direto';
    const updated = document.createElement('td');
    updated.className = 'customer-updated';
    updated.dataset.label = 'Atualizado';
    updated.textContent = new Intl.DateTimeFormat('pt-BR').format(new Date(customer.updatedAt));
    const actions = document.createElement('td');
    actions.className = 'customer-actions';
    actions.dataset.label = 'Ações';
    const actionButtons = document.createElement('div');
    actionButtons.className = 'customer-actions-buttons';
    actionButtons.append(
      actionButton('Visualizar', 'btn btn-ghost btn-xs', () => openCustomerDetails(customer)),
    );
    if (canManage()) {
      actionButtons.append(
        actionButton('Editar', 'btn btn-ghost btn-xs', () => openForm(customer.id)),
        actionButton(
          customer.active ? 'Desativar' : 'Ativar',
          customer.active ? 'btn btn-danger btn-xs' : 'btn btn-ghost btn-xs',
          () => openStatus(customer.id),
        ),
      );
    }
    actions.append(actionButtons);
    row.append(
      code,
      legalName,
      cnpj,
      city,
      state,
      customerClass,
      segment,
      seller,
      representative,
      updated,
      actions,
    );
    body.append(row);
  }
}

function renderPagination(): void {
  element<HTMLElement>('#customers-page-label').textContent = `Página ${page} de ${totalPages}`;
  element<HTMLButtonElement>('#customers-prev').disabled = page <= 1;
  element<HTMLButtonElement>('#customers-next').disabled = page >= totalPages;
}

async function load(): Promise<void> {
  const sequence = ++requestSequence;
  const body = element<HTMLTableSectionElement>('#customers-body');
  body.innerHTML = '<tr><td class="customers-loading" colspan="11">Carregando clientes…</td></tr>';
  try {
    const response = await listCustomers(currentQuery());
    if (sequence !== requestSequence) return;
    customers = response.data.customers;
    filters = response.data.filters;
    page = response.data.pagination.page;
    totalPages = response.data.pagination.totalPages;
    renderFilters();
    renderCustomers();
    renderPagination();
  } catch (error) {
    if (sequence !== requestSequence) return;
    body.innerHTML = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 11;
    cell.className = 'customers-empty';
    cell.textContent = apiMessage(error);
    cell.append(
      document.createElement('br'),
      actionButton('Tentar novamente', 'btn btn-ghost btn-sm customers-retry', () => void load()),
    );
    row.append(cell);
    body.append(row);
  }
}

async function loadClassifications(): Promise<void> {
  const response = await listCustomerClassifications();
  customerClasses = response.data.customerClasses;
  customerSegments = response.data.customerSegments;
  renderFilters();
  populateClassificationSelect('#customer-class', customerClasses, 'Não classificado');
  populateClassificationSelect('#customer-segment', customerSegments, 'Não classificado');
}

async function loadPage(): Promise<void> {
  const addButton = element<HTMLButtonElement>('#customers-add');
  addButton.disabled = true;
  try {
    await loadClassifications();
    addButton.disabled = false;
    await load();
  } catch (error) {
    setFeedback(apiMessage(error), true);
    const body = element<HTMLTableSectionElement>('#customers-body');
    clear(body);
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 11;
    cell.className = 'customers-empty';
    cell.textContent = 'Não foi possível carregar as classificações de clientes.';
    cell.append(
      document.createElement('br'),
      actionButton(
        'Tentar novamente',
        'btn btn-ghost btn-sm customers-retry',
        () => void loadPage(),
      ),
    );
    row.append(cell);
    body.append(row);
  }
}

function closeModal(id: string): void {
  element<HTMLElement>(`#${id}`).classList.remove('open');
}

function createOrder(customer: Customer, link: CustomerCalculationLink): void {
  if (!customer.active || !link.current) return;
  const returnTo = new URL('/clientes', window.location.origin);
  returnTo.searchParams.set('cliente', customer.id);
  returnTo.searchParams.set('aba', 'kits');
  const params = new URLSearchParams({
    calculo: link.calculationId,
    cliente: customer.id,
    returnTo: `${returnTo.pathname}${returnTo.search}`,
  });
  closeModal('customer-links-modal');
  window.history.pushState(
    { orderOrigin: `${returnTo.pathname}${returnTo.search}` },
    '',
    `/pedidos/novo?${params.toString()}`,
  );
  window.show('pedido');
}

function renderCalculationLink(link: CustomerCalculationLink): HTMLElement {
  const card = document.createElement('details');
  card.className = 'customer-calculation-card';
  const summary = document.createElement('summary');
  summary.className = 'customer-calculation-summary';
  const heading = document.createElement('div');
  heading.className = 'customer-calculation-heading';
  const title = document.createElement('strong');
  title.textContent = `${link.kitCode} · ${link.kitDescription}`;
  const controls = document.createElement('span');
  controls.className = 'customer-calculation-controls';
  const status = badge(
    link.current ? 'Atual' : `Versão ${link.version}`,
    link.current ? 'tag-green' : 'tag-gray',
  );
  const count = document.createElement('span');
  count.className = 'customer-calculation-count';
  count.textContent = `${link.items.length} ${link.items.length === 1 ? 'item' : 'itens'}`;
  const order = actionButton('Gerar pedido', 'btn btn-ghost btn-xs', () => {
    if (viewedCustomer) createOrder(viewedCustomer, link);
  });
  order.disabled = !link.current || !viewedCustomer?.active;
  order.title = !link.current
    ? 'Somente a versÃ£o atual pode iniciar um pedido.'
    : !viewedCustomer?.active
      ? 'Ative o cliente para iniciar um pedido.'
      : '';
  order.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  const arrow = document.createElement('span');
  arrow.className = 'customer-calculation-arrow';
  arrow.textContent = '›';
  controls.append(status, count, order, arrow);
  heading.append(title, controls);
  const meta = document.createElement('div');
  meta.className = 'customer-calculation-meta';
  meta.textContent = `${link.priceListName} · cálculo v${link.version} · vínculo em ${new Intl.DateTimeFormat('pt-BR').format(new Date(link.linkedAt))} por ${link.linkedBy}${link.className ? ` · classe ${link.className}` : ''}`;
  summary.append(heading, meta);
  const content = document.createElement('div');
  content.className = 'customer-calculation-content';
  const table = document.createElement('table');
  table.className = 'customer-calculation-items';
  const head = table.createTHead().insertRow();
  for (const [index, label] of [
    'Código',
    'Item vinculado',
    'Qtde.',
    'UM',
    'Mínimo',
    'Máximo',
  ].entries()) {
    const cell = document.createElement('th');
    cell.textContent = label;
    if (index >= 4) cell.classList.add('reference-price');
    head.append(cell);
  }
  const body = table.createTBody();
  for (const item of link.items) {
    const row = body.insertRow();
    for (const [index, value] of [
      item.code,
      item.description,
      Number(item.quantity).toLocaleString('pt-BR'),
      item.unit,
      Number(item.minimumUnitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      Number(item.normalUnitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    ].entries()) {
      const cell = row.insertCell();
      cell.textContent = value;
      if (index >= 4) cell.classList.add('reference-price');
    }
  }
  if (!link.items.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = 'Este cálculo não possui itens vinculados.';
  }
  content.append(table);
  card.append(summary, content);
  return card;
}

function customerInfoItem(
  label: string,
  value: string | null | undefined,
  wide = false,
): HTMLElement {
  const item = document.createElement('div');
  item.className = `customer-info-item${wide ? ' is-wide' : ''}${value ? '' : ' is-empty'}`;
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value || 'Não informado';
  item.append(term, description);
  return item;
}

function renderCustomerInfo(customer: Customer): void {
  const panel = element<HTMLElement>('#customer-info-panel');
  const grid = document.createElement('dl');
  grid.className = 'customer-info-grid';
  grid.append(
    customerInfoItem('Código', customer.code),
    customerInfoItem('Situação', customer.active ? 'Ativo' : 'Desativado'),
    customerInfoItem('CNPJ', customer.cnpj ? formatCnpj(customer.cnpj) : null),
    customerInfoItem('Razão social', customer.legalName, true),
    customerInfoItem('Cidade', customer.city),
    customerInfoItem('UF', customer.state),
    customerInfoItem('Classe', customer.customerClass?.name),
    customerInfoItem('Segmento', customer.customerSegment?.name),
    customerInfoItem('Vendedor', customer.seller),
    customerInfoItem('Representante', customer.representative || 'Venda direta'),
    customerInfoItem('Observação do perfil', customer.internalNote, true),
    customerInfoItem('Observação padrão do pedido', customer.orderNote, true),
  );
  panel.replaceChildren(grid);
}

async function loadCustomerLinks(customer: Customer): Promise<void> {
  if (loadedLinksCustomerId === customer.id) return;
  loadedLinksCustomerId = customer.id;
  const body = element<HTMLElement>('#customer-links-body');
  body.replaceChildren();
  body.append(document.createTextNode('Carregando vínculos…'));
  try {
    const response = await getCustomerCalculationLinks(customer.id);
    if (viewedCustomer?.id !== customer.id) return;
    body.replaceChildren();
    if (!response.data.calculations.length) {
      const empty = document.createElement('div');
      empty.className = 'customers-empty';
      empty.textContent = 'Nenhum kit está vinculado a este cliente.';
      body.append(empty);
      return;
    }
    for (const link of response.data.calculations) body.append(renderCalculationLink(link));
  } catch (error) {
    if (viewedCustomer?.id !== customer.id) return;
    loadedLinksCustomerId = null;
    body.replaceChildren();
    const failure = document.createElement('div');
    failure.className = 'customers-empty';
    failure.textContent = apiMessage(error);
    failure.append(
      document.createElement('br'),
      actionButton('Tentar novamente', 'btn btn-ghost btn-sm customers-retry', () => {
        void loadCustomerLinks(customer);
      }),
    );
    body.append(failure);
  }
}

function selectCustomerDetailsTab(tab: 'info' | 'kits'): void {
  const showInfo = tab === 'info';
  const infoTab = element<HTMLButtonElement>('#customer-info-tab');
  const kitsTab = element<HTMLButtonElement>('#customer-kits-tab');
  infoTab.classList.toggle('is-active', showInfo);
  kitsTab.classList.toggle('is-active', !showInfo);
  infoTab.setAttribute('aria-selected', String(showInfo));
  kitsTab.setAttribute('aria-selected', String(!showInfo));
  element<HTMLElement>('#customer-info-panel').hidden = !showInfo;
  element<HTMLElement>('#customer-kits-panel').hidden = showInfo;
  if (!showInfo && viewedCustomer) void loadCustomerLinks(viewedCustomer);
}

function openCustomerDetails(customer: Customer): void {
  viewedCustomer = customer;
  loadedLinksCustomerId = null;
  element<HTMLElement>('#customer-links-title').textContent = 'Detalhes do cliente';
  element<HTMLElement>('#customer-details-subtitle').textContent =
    `${customer.code} · ${customer.legalName}`;
  element<HTMLElement>('#customer-links-body').replaceChildren();
  renderCustomerInfo(customer);
  selectCustomerDetailsTab('info');
  element<HTMLElement>('#customer-links-modal').classList.add('open');
}

function inputValue(id: string): string {
  return element<HTMLInputElement>(`#${id}`).value;
}

function setInputValue(id: string, value: string | null): void {
  element<HTMLInputElement | HTMLTextAreaElement>(`#${id}`).value = value ?? '';
}

function formatCnpj(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function selectClassification(
  selector: string,
  value: CustomerClass | CustomerSegment | null | undefined,
): void {
  const select = element<HTMLSelectElement>(selector);
  if (value && ![...select.options].some((item) => item.value === value.id)) {
    const unavailable = option(value.id, `${value.name} (inativa)`);
    unavailable.disabled = true;
    select.append(unavailable);
  }
  select.value = value?.id ?? '';
}

function classificationSelection(selector: string): string | null | undefined {
  const select = element<HTMLSelectElement>(selector);
  const selected = select.selectedOptions[0];
  if (selected?.disabled) return undefined;
  return select.value || null;
}

function openForm(id?: string): void {
  if (!canManage()) return;
  const customer = id ? customers.find((item) => item.id === id) : undefined;
  editingCustomerId = customer?.id ?? null;
  element<HTMLElement>('#customer-form-title').textContent = customer
    ? 'Editar cliente'
    : 'Adicionar cliente';
  element<HTMLButtonElement>('#customer-form-submit').textContent = customer
    ? 'Salvar alterações'
    : 'Adicionar cliente';
  setInputValue('customer-code', customer?.code ?? '');
  setInputValue('customer-legal-name', customer?.legalName ?? '');
  setInputValue('customer-cnpj', formatCnpj(customer?.cnpj ?? ''));
  setInputValue('customer-city', customer?.city ?? '');
  setInputValue('customer-state', customer?.state ?? '');
  selectClassification('#customer-class', customer?.customerClass);
  selectClassification('#customer-segment', customer?.customerSegment);
  setInputValue('customer-seller', customer?.seller ?? '');
  setInputValue('customer-representative', customer?.representative ?? '');
  setInputValue('customer-internal-note', customer?.internalNote ?? '');
  setInputValue('customer-order-note', customer?.orderNote ?? '');
  setFormError('');
  element<HTMLElement>('#customer-form-modal').classList.add('open');
  element<HTMLInputElement>('#customer-code').focus();
}

function openStatus(id: string): void {
  if (!canManage()) return;
  const customer = customers.find((item) => item.id === id);
  if (!customer) return;
  statusTarget = { id, active: !customer.active };
  const activating = !customer.active;
  element<HTMLElement>('#customer-status-title').textContent = activating
    ? 'Ativar cliente'
    : 'Desativar cliente';
  element<HTMLElement>('#customer-status-message').textContent = activating
    ? `${customer.legalName} voltará a ficar disponível para novos pedidos.`
    : `${customer.legalName} deixará de ficar disponível para novos pedidos, sem perder o histórico.`;
  const confirm = element<HTMLButtonElement>('#customer-status-confirm');
  confirm.textContent = activating ? 'Ativar cliente' : 'Desativar cliente';
  confirm.className = activating ? 'btn btn-primary' : 'btn btn-danger';
  element<HTMLElement>('#customer-status-error').hidden = true;
  element<HTMLElement>('#customer-status-modal').classList.add('open');
}

function formInput(): CustomerInput {
  const customerClassId = classificationSelection('#customer-class');
  const customerSegmentId = classificationSelection('#customer-segment');
  const customerSegment = customerSegments.find((item) => item.id === customerSegmentId);
  const editingCustomer = editingCustomerId
    ? customers.find((customer) => customer.id === editingCustomerId)
    : undefined;
  return {
    code: inputValue('customer-code'),
    legalName: inputValue('customer-legal-name'),
    cnpj: inputValue('customer-cnpj'),
    city: inputValue('customer-city'),
    state: inputValue('customer-state'),
    segment:
      customerSegmentId === undefined
        ? (editingCustomer?.segment ?? '')
        : customerSegment
          ? legacyCustomerSegmentLabel(customerSegment)
          : '',
    ...(customerClassId !== undefined ? { customerClassId } : {}),
    ...(customerSegmentId !== undefined ? { customerSegmentId } : {}),
    seller: inputValue('customer-seller'),
    representative: inputValue('customer-representative'),
    internalNote: inputValue('customer-internal-note'),
    orderNote: inputValue('customer-order-note'),
  };
}

async function submitForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const submit = element<HTMLButtonElement>('#customer-form-submit');
  submit.disabled = true;
  setFormError('');
  try {
    if (editingCustomerId) await updateCustomer(editingCustomerId, formInput());
    else await createCustomer(formInput());
    closeModal('customer-form-modal');
    setFeedback(
      editingCustomerId ? 'Cliente atualizado com sucesso.' : 'Cliente adicionado com sucesso.',
    );
    page = 1;
    await load();
  } catch (error) {
    setFormError(apiMessage(error));
  } finally {
    submit.disabled = false;
  }
}

async function confirmStatus(): Promise<void> {
  if (!statusTarget) return;
  const confirm = element<HTMLButtonElement>('#customer-status-confirm');
  const errorTarget = element<HTMLElement>('#customer-status-error');
  confirm.disabled = true;
  errorTarget.hidden = true;
  try {
    await setCustomerActive(statusTarget.id, statusTarget.active);
    closeModal('customer-status-modal');
    setFeedback(`Cliente ${statusTarget.active ? 'ativado' : 'desativado'} com sucesso.`);
    await load();
  } catch (error) {
    errorTarget.textContent = apiMessage(error);
    errorTarget.hidden = false;
  } finally {
    confirm.disabled = false;
  }
}

function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  return `"${text.replaceAll('"', '""')}"`;
}

async function performExport(): Promise<void> {
  const button = element<HTMLButtonElement>('#customers-export');
  button.disabled = true;
  setFeedback('');
  try {
    const query = currentQuery();
    delete query.page;
    delete query.pageSize;
    const response = await exportCustomers(query);
    const rows = [
      [
        'Código',
        'Razão Social',
        'CNPJ',
        'Cidade',
        'Estado',
        'Classe',
        'Segmento',
        'Vendedor',
        'Representante',
        'Situação',
      ],
      ...response.data.customers.map((customer) => [
        customer.code,
        customer.legalName,
        customer.cnpj,
        customer.city,
        customer.state,
        customer.customerClass?.name ?? 'Não classificado',
        customer.customerSegment?.name ?? 'Não classificado',
        customer.seller,
        customer.representative,
        customer.active ? 'Ativo' : 'Desativado',
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'base_clientes.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    const total = response.data.customers.length;
    setFeedback(
      `${total.toLocaleString('pt-BR')} cliente${total === 1 ? '' : 's'} exportado${total === 1 ? '' : 's'}.`,
    );
  } catch (error) {
    setFeedback(apiMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

function resetFilters(): void {
  element<HTMLInputElement>('#customers-search').value = '';
  element<HTMLSelectElement>('#customers-class').value = '';
  element<HTMLSelectElement>('#customers-segment').value = '';
  element<HTMLSelectElement>('#customers-seller').value = '';
  element<HTMLSelectElement>('#customers-representative').value = '';
  element<HTMLSelectElement>('#customers-status').value = 'active';
  page = 1;
  void load();
}

export function initializeCustomersPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLInputElement>('#customers-search').addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      page = 1;
      void load();
    }, 250);
  });
  for (const selector of [
    '#customers-class',
    '#customers-segment',
    '#customers-seller',
    '#customers-representative',
    '#customers-status',
  ]) {
    element<HTMLSelectElement>(selector).addEventListener('change', () => {
      page = 1;
      void load();
    });
  }
  element<HTMLButtonElement>('#customers-clear').addEventListener('click', resetFilters);
  element<HTMLButtonElement>('#customers-add').addEventListener('click', () => openForm());
  element<HTMLButtonElement>('#customers-export').addEventListener(
    'click',
    () => void performExport(),
  );
  element<HTMLButtonElement>('#customers-prev').addEventListener('click', () => {
    if (page > 1) {
      page -= 1;
      void load();
    }
  });
  element<HTMLButtonElement>('#customers-next').addEventListener('click', () => {
    if (page < totalPages) {
      page += 1;
      void load();
    }
  });
  element<HTMLFormElement>('#customer-form').addEventListener('submit', (event) => {
    void submitForm(event);
  });
  element<HTMLInputElement>('#customer-cnpj').addEventListener('input', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    input.value = formatCnpj(input.value);
  });
  element<HTMLInputElement>('#customer-state').addEventListener('input', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    input.value = input.value
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 2);
  });
  element<HTMLButtonElement>('#customer-status-confirm').addEventListener('click', () => {
    void confirmStatus();
  });
  element<HTMLButtonElement>('#customer-info-tab').addEventListener('click', () => {
    selectCustomerDetailsTab('info');
  });
  element<HTMLButtonElement>('#customer-kits-tab').addEventListener('click', () => {
    selectCustomerDetailsTab('kits');
  });
  for (const selector of ['#customer-form-close', '#customer-form-cancel']) {
    element<HTMLButtonElement>(selector).addEventListener('click', () =>
      closeModal('customer-form-modal'),
    );
  }
  for (const selector of ['#customer-status-close', '#customer-status-cancel']) {
    element<HTMLButtonElement>(selector).addEventListener('click', () =>
      closeModal('customer-status-modal'),
    );
  }
  for (const selector of ['#customer-links-close', '#customer-links-done']) {
    element<HTMLButtonElement>(selector).addEventListener('click', () =>
      closeModal('customer-links-modal'),
    );
  }
}

export function showCustomersPage(user: AuthenticatedUser): void {
  currentUser = user;
  element<HTMLButtonElement>('#customers-add').hidden = !canManage();
  setFeedback('');
  void (async () => {
    await loadPage();
    const query = new URLSearchParams(window.location.search);
    const customerId = query.get('cliente');
    if (!customerId || query.get('aba') !== 'kits') return;
    try {
      const customer = (await getCustomer(customerId)).data.customer;
      if (window.location.pathname !== '/clientes') return;
      openCustomerDetails(customer);
      selectCustomerDetailsTab('kits');
    } catch (error) {
      setFeedback(apiMessage(error), true);
    }
  })();
}
