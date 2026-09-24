import type { AuthenticatedUser } from '../shared/auth.js';
import type {
  CalculationDetail,
  CalculationDetailItem,
  CalculationHistoryItem,
} from '../shared/pricing.js';
import { descriptionWithoutUser } from './display-text.js';
import { ApiError } from './services/api.js';
import { getCalculation, getCalculationHistory } from './services/calculations-api.js';
import { createMediaImage } from './components/media-image.js';
import {
  downloadCalculationPdf,
  downloadCalculationWorkbook,
  type CalculationExportData,
  type ExportImageSource,
} from './calculation-export.js';

let initialized = false;
let currentUser: AuthenticatedUser | null = null;
let calculation: CalculationDetail | null = null;
let requestSequence = 0;

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tagName);
  if (className) created.className = className;
  if (text) created.textContent = text;
  return created;
}

function money(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}

function decimal(value: string): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(Number(value));
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
    .format(new Date(value))
    .replace(',', '');
}

function info(label: string, value: string, code = false): HTMLDivElement {
  const field = node('div', 'kf');
  field.append(node('div', 'kfL', label), node('div', `kfV${code ? ' code' : ''}`, value));
  return field;
}

function totalCard(kind: string, label: string, value: string, sub = ''): HTMLDivElement {
  const card = node('div', `tCard ${kind}`);
  card.append(node('div', 'tLabel', label), node('div', 'tVal', value));
  if (sub) card.append(node('div', 'tSub', sub));
  return card;
}

function appendCell(row: HTMLTableRowElement, text: string, className = ''): void {
  const cell = row.insertCell();
  cell.textContent = text;
  if (className) cell.className = className;
}

function renderItem(row: CalculationDetailItem, body: HTMLTableSectionElement): void {
  const tr = body.insertRow();
  if (!row.hasPrice) tr.className = 'missing-price-row';
  appendCell(tr, row.code, 'cod2');
  appendCell(tr, descriptionWithoutUser(row.description));
  appendCell(tr, decimal(row.quantity), 'r2');
  appendCell(tr, row.unit);
  appendCell(
    tr,
    row.hasPrice ? money(row.minimumUnitPrice) : 'Sem preço',
    `${row.hasPrice ? 'pm2' : 'np2'} reference-price`,
  );
  appendCell(
    tr,
    row.hasPrice ? money(row.minimumTotal) : '—',
    `${row.hasPrice ? 'tm2' : 'np2'} reference-price`,
  );
  appendCell(
    tr,
    row.hasPrice ? money(row.normalUnitPrice) : 'Sem preço',
    `${row.hasPrice ? 'pn2' : 'np2'} reference-price`,
  );
  appendCell(
    tr,
    row.hasPrice ? money(row.normalTotal) : '—',
    `${row.hasPrice ? 'tn2' : 'np2'} reference-price`,
  );
}

function renderDetail(detail: CalculationDetail): void {
  const main = element<HTMLElement>('#detalhe-main');
  main.replaceChildren();
  const wrapper = node('div', 'fu2');
  const header = node('div', 'kitCard');
  const description = info('Descrição', descriptionWithoutUser(detail.kitDescription));
  description.setAttribute('style', 'flex:1;min-width:180px');
  const linkedCustomers = detail.customers ?? [];
  const photo = node('div', 'detail-version-photo');
  photo.append(
    createMediaImage({
      image: detail.image,
      variant: 'display',
      entityLabel: 'Kit',
      code: detail.kitCode,
      description: descriptionWithoutUser(detail.kitDescription),
      width: 180,
      height: 132,
      lazy: false,
      expandable: true,
    }),
    node('span', 'detail-version-photo__label', 'Foto do kit'),
  );
  header.append(
    photo,
    info('Código', detail.kitCode, true),
    description,
    info('Perfil de preço', detail.priceList.name),
    info('Cálculo / Lista', `v${detail.version} / v${detail.priceListVersion.version}`),
    info('Calculado em', dateTime(detail.createdAt)),
    info('Por', detail.createdBy),
    info(
      'Clientes vinculados',
      linkedCustomers.length
        ? linkedCustomers.map((customer) => `${customer.code} · ${customer.legalName}`).join(', ')
        : 'Nenhum cliente vinculado',
    ),
  );
  if (!detail.current) {
    const historical = node('span', 'tag tag-gray', 'Versão histórica');
    historical.setAttribute('style', 'font-size:11px;padding:5px 10px');
    header.append(historical);
  }

  const totals = node('div', 'totGrid');
  totals.append(
    totalCard('min reference-price', 'Tabela Mínima', money(detail.minimumTotal)),
    totalCard('nor reference-price', 'Valor máximo', money(detail.normalTotal)),
    totalCard(
      'inf',
      'Composição',
      String(detail.itemCount),
      `${detail.missingPriceCount} sem preço`,
    ),
  );

  const tableCard = node('div', 'tblCard');
  const toolbar = node('div', 'tbar');
  toolbar.append(node('div', 'tbarT', 'Composição do Kit'), node('div', 'tsp'));
  if (currentUser?.permissions.includes('calculation.export')) {
    const excelButton = node('button', 'expBtn', 'Exportar Excel');
    excelButton.type = 'button';
    excelButton.addEventListener('click', () => void exportCalculation(excelButton));
    const pdfButton = node('button', 'expBtn', 'Exportar PDF');
    pdfButton.type = 'button';
    pdfButton.addEventListener('click', () => void exportCalculationPdf(pdfButton));
    toolbar.append(excelButton, pdfButton);
  }
  const scroll = node('div');
  scroll.setAttribute('style', 'overflow:auto;max-height:520px');
  const table = node('table');
  const head = table.createTHead().insertRow();
  for (const [index, label] of [
    'Código',
    'Descrição',
    'Qtde.',
    'UM',
    'Preço Mín.',
    'Total Mín.',
    'Preço máximo',
    'Total máximo',
  ].entries())
    head.append(node('th', index >= 4 ? 'reference-price' : '', label));
  const body = table.createTBody();
  for (const item of detail.items) renderItem(item, body);
  const footRow = table.createTFoot().insertRow();
  const totalLabel = footRow.insertCell();
  totalLabel.colSpan = 4;
  totalLabel.textContent = 'Total Geral';
  appendCell(footRow, '', 'reference-price');
  appendCell(footRow, money(detail.minimumTotal), 'tm2 reference-price');
  appendCell(footRow, '', 'reference-price');
  appendCell(footRow, money(detail.normalTotal), 'tn2 reference-price');
  scroll.append(table);
  tableCard.append(toolbar, scroll);
  wrapper.append(header, totals, tableCard);
  main.append(wrapper);
}

function renderState(title: string, message = ''): void {
  const main = element<HTMLElement>('#detalhe-main');
  main.replaceChildren();
  const state = node('div', 'calc-empty');
  state.append(node('div', 'calc-empty-ico', 'Kit'), node('div', 'calc-empty-title', title));
  if (message) state.append(node('div', 'calc-empty-desc', message));
  main.append(state);
}

function safeReturnTo(): string {
  const requested = new URLSearchParams(window.location.search).get('returnTo');
  if (!requested || !requested.startsWith('/calculos') || requested.startsWith('//'))
    return '/calculos';
  return requested;
}

function backToSearch(): void {
  const destination = safeReturnTo();
  window.history.pushState(null, '', destination);
  window.show('busca');
}

function closeHistory(): void {
  element<HTMLElement>('#modal-historico').classList.remove('open');
}

function navigateToVersion(id: string): void {
  closeHistory();
  const returnTo = safeReturnTo();
  window.history.pushState(
    null,
    '',
    `/calculos/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(returnTo)}`,
  );
  window.show('detalhe');
}

function originLabel(origin: string): string {
  const labels: Record<string, string> = {
    FIRST_CALCULATION: 'Primeiro cálculo',
    MANUAL_RECALCULATION: 'Recálculo manual',
    MATRIX_RECALCULATION: 'Recálculo por lista',
    NEW_PROCESS_FILE: 'Nova folha de processo',
  };
  return labels[origin] ?? origin.replaceAll('_', ' ').toLocaleLowerCase('pt-BR');
}

function historyEntry(version: CalculationHistoryItem): HTMLDivElement {
  const entry = node('div');
  entry.setAttribute(
    'style',
    'display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--border);flex-wrap:wrap',
  );
  const marker = node('div');
  marker.setAttribute(
    'style',
    `width:10px;height:10px;border-radius:50%;background:${version.current ? 'var(--accent)' : 'var(--text3)'};flex-shrink:0`,
  );
  const content = node('div');
  content.setAttribute('style', 'flex:1;min-width:220px');
  const title = node('div', '', `Versão ${version.version}`);
  title.setAttribute('style', 'font-size:13px;font-weight:600');
  if (version.current) title.append(' ', node('span', 'tag tag-green', 'atual'));
  content.append(
    title,
    node('div', 'order-source', `${dateTime(version.createdAt)} · por ${version.createdBy}`),
    node(
      'div',
      'order-source',
      `${originLabel(version.origin)} · lista v${version.priceListVersion} · ${version.itemCount} itens`,
    ),
    node(
      'div',
      'reference-price',
      `${money(version.minimumTotal)} (mín.) · ${money(version.normalTotal)} (máx.)`,
    ),
  );
  const photo = createMediaImage({
    image: version.image,
    entityLabel: 'Kit',
    code: calculation?.kitCode ?? '',
    description: calculation ? descriptionWithoutUser(calculation.kitDescription) : '',
    width: 64,
    height: 48,
    expandable: true,
  });
  const actions = node('div');
  actions.setAttribute('style', 'display:flex;gap:6px');
  const view = node('button', 'btn btn-ghost btn-sm', 'Ver composição');
  view.type = 'button';
  view.addEventListener('click', () => navigateToVersion(version.id));
  actions.append(view);
  if (currentUser?.permissions.includes('calculation.export')) {
    const excelButton = node('button', 'btn btn-ghost btn-sm', 'Excel');
    excelButton.type = 'button';
    excelButton.addEventListener(
      'click',
      () => void exportVersion(version.id, 'excel', excelButton),
    );
    const pdfButton = node('button', 'btn btn-ghost btn-sm', 'PDF');
    pdfButton.type = 'button';
    pdfButton.addEventListener('click', () => void exportVersion(version.id, 'pdf', pdfButton));
    actions.append(excelButton, pdfButton);
  }
  entry.append(marker, photo, content, actions);
  return entry;
}

async function openHistory(): Promise<void> {
  if (!calculation) return;
  const modal = element<HTMLElement>('#modal-historico');
  const body = element<HTMLElement>('#hist-modal-body');
  modal.classList.add('open');
  body.replaceChildren(node('div', 'order-state', 'Carregando histórico…'));
  try {
    const response = await getCalculationHistory(calculation.id);
    element<HTMLElement>('#hist-modal-title').textContent =
      `Histórico — Kit ${response.data.kit.code}`;
    element<HTMLElement>('#hist-modal-sub').textContent =
      `${descriptionWithoutUser(response.data.kit.description)} · ${response.data.priceList.name}`;
    body.replaceChildren();
    for (const version of response.data.versions) body.append(historyEntry(version));
  } catch (error) {
    body.replaceChildren(
      node(
        'div',
        'order-state error',
        error instanceof ApiError ? error.message : 'Não foi possível carregar o histórico.',
      ),
    );
  }
}

function exportData(detail: CalculationDetail): CalculationExportData {
  return {
    kitCode: detail.kitCode,
    kitDescription: descriptionWithoutUser(detail.kitDescription),
    calculationVersion: detail.version,
    priceListName: detail.priceList.name,
    priceListVersion: detail.priceListVersion.version,
    createdAt: detail.createdAt,
    createdBy: detail.createdBy,
    minimumTotal: Number(detail.minimumTotal),
    normalTotal: Number(detail.normalTotal),
    itemCount: detail.itemCount,
    missingPriceCount: detail.missingPriceCount,
    items: detail.items.map((item) => ({
      code: item.code,
      description: descriptionWithoutUser(item.description),
      quantity: Number(item.quantity),
      unit: item.unit,
      minimumUnitPrice: Number(item.minimumUnitPrice),
      minimumTotal: Number(item.minimumTotal),
      normalUnitPrice: Number(item.normalUnitPrice),
      normalTotal: Number(item.normalTotal),
      hasPrice: item.hasPrice,
    })),
  };
}

function exportImage(detail: CalculationDetail): ExportImageSource | null {
  return detail.image
    ? { source: detail.image.displayUrl, width: detail.image.width, height: detail.image.height }
    : null;
}

async function withExportButton(
  button: HTMLButtonElement,
  action: () => Promise<void>,
): Promise<void> {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Gerando…';
  try {
    await action();
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Não foi possível gerar o arquivo.');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

async function exportCalculation(button: HTMLButtonElement): Promise<void> {
  if (!calculation) return;
  const detail = calculation;
  await withExportButton(button, () =>
    downloadCalculationWorkbook(
      exportData(detail),
      exportImage(detail),
      `Calculo_${detail.kitCode}_v${detail.version}.xlsx`,
    ),
  );
}

async function exportCalculationPdf(button: HTMLButtonElement): Promise<void> {
  if (!calculation) return;
  const detail = calculation;
  await withExportButton(button, () =>
    downloadCalculationPdf(
      exportData(detail),
      exportImage(detail),
      `Calculo_${detail.kitCode}_v${detail.version}.pdf`,
    ),
  );
}

async function exportVersion(
  id: string,
  format: 'excel' | 'pdf',
  button: HTMLButtonElement,
): Promise<void> {
  await withExportButton(button, async () => {
    try {
      const detail = (await getCalculation(id)).data.calculation;
      if (format === 'pdf')
        await downloadCalculationPdf(
          exportData(detail),
          exportImage(detail),
          `Calculo_${detail.kitCode}_v${detail.version}.pdf`,
        );
      else
        await downloadCalculationWorkbook(
          exportData(detail),
          exportImage(detail),
          `Calculo_${detail.kitCode}_v${detail.version}.xlsx`,
        );
    } catch (error) {
      throw new Error(
        error instanceof ApiError ? error.message : 'Não foi possível exportar esta versão.',
      );
    }
  });
}

function createOrder(): void {
  if (!calculation?.current) return;
  const orderOrigin = `${window.location.pathname}${window.location.search}`;
  const params = new URLSearchParams({
    calculo: calculation.id,
    returnTo: orderOrigin,
  });
  window.history.pushState({ orderOrigin }, '', `/pedidos/novo?${params.toString()}`);
  window.show('pedido');
}

async function load(id: string): Promise<void> {
  const sequence = ++requestSequence;
  calculation = null;
  renderState('Carregando cálculo…', 'Consultando a fotografia salva no banco de dados.');
  try {
    const response = await getCalculation(id);
    if (sequence !== requestSequence) return;
    calculation = response.data.calculation;
    renderDetail(calculation);
    element<HTMLButtonElement>('#detail-order').disabled = !calculation.current;
    element<HTMLButtonElement>('#detail-order').title = calculation.current
      ? ''
      : 'Somente a versão atual pode iniciar um pedido.';
  } catch (error) {
    if (sequence !== requestSequence) return;
    renderState(
      error instanceof ApiError && error.status === 404
        ? 'Cálculo não encontrado'
        : 'Não foi possível carregar o cálculo',
      error instanceof Error ? error.message : 'Tente novamente em alguns instantes.',
    );
  }
}

export function initializeDetailPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLButtonElement>('#detail-back').addEventListener('click', backToSearch);
  element<HTMLButtonElement>('#detail-history').addEventListener('click', () => void openHistory());
  element<HTMLButtonElement>('#detail-order').addEventListener('click', createOrder);
  element<HTMLButtonElement>('#detail-history-close').addEventListener('click', closeHistory);
  element<HTMLButtonElement>('#detail-history-done').addEventListener('click', closeHistory);
  element<HTMLElement>('#modal-historico').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeHistory();
  });
}

export function showDetailPage(user: AuthenticatedUser, id: string): void {
  currentUser = user;
  element<HTMLButtonElement>('#detail-history').hidden =
    !user.permissions.includes('calculation.history');
  element<HTMLButtonElement>('#detail-order').hidden = !user.permissions.includes('order.access');
  closeHistory();
  void load(id);
}
