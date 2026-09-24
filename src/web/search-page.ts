import type { CalculationSearchItem, CalculationSearchSort } from '../shared/pricing.js';
import { descriptionWithoutUser } from './display-text.js';
import { listCalculations } from './services/calculations-api.js';
import { createMediaImage } from './components/media-image.js';

const PAGE_SIZE = 30;
const validSorts = new Set<CalculationSearchSort>([
  'code',
  'description',
  'priceList',
  'minimumTotal',
  'normalTotal',
  'createdAt',
]);
const headerIds: Record<CalculationSearchSort, string> = {
  code: 'bsh-code',
  description: 'bsh-desc',
  reference: 'bsh-reference',
  priceList: 'bsh-client',
  minimumTotal: 'bsh-tabMin',
  normalTotal: 'bsh-tabNor',
  createdAt: 'bsh-date',
};

let initialized = false;
let requestSequence = 0;
let debounceTimer = 0;
let state = readState();

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function readState() {
  const params = new URLSearchParams(window.location.search);
  const requestedSort = params.get('ordem') as CalculationSearchSort | null;
  return {
    search: params.get('q')?.trim() ?? '',
    priceListId: params.get('perfil') ?? '',
    sort: requestedSort && validSorts.has(requestedSort) ? requestedSort : 'createdAt',
    direction: params.get('direcao') === 'asc' ? ('asc' as const) : ('desc' as const),
    page: Math.max(1, Number.parseInt(params.get('pagina') ?? '1', 10) || 1),
  };
}

function writeState(): void {
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  if (state.priceListId) params.set('perfil', state.priceListId);
  if (state.sort !== 'createdAt') params.set('ordem', state.sort);
  if (state.direction !== 'desc') params.set('direcao', state.direction);
  if (state.page !== 1) params.set('pagina', String(state.page));
  const query = params.toString();
  window.history.replaceState(null, '', `/calculos${query ? `?${query}` : ''}`);
}

function money(value: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(value))
    .replace(',', '');
}

function profileTagClass(item: CalculationSearchItem): string {
  const name = `${item.priceList.code} ${item.priceList.name}`.toLocaleLowerCase('pt-BR');
  if (name.includes('implement')) return 'tag-blue';
  if (name.includes('comérc') || name.includes('reposi')) return 'tag-orange';
  return 'tag-gray';
}

function cell(row: HTMLTableRowElement, text: string, style = ''): HTMLTableCellElement {
  const td = row.insertCell();
  td.textContent = text;
  if (style) td.setAttribute('style', style);
  return td;
}

function renderRows(calculations: CalculationSearchItem[]): void {
  const body = element<HTMLTableSectionElement>('#busca-tbody');
  body.replaceChildren();
  for (const calculation of calculations) {
    const row = body.insertRow();
    const photo = row.insertCell();
    photo.className = 'search-photo-cell';
    photo.append(
      createMediaImage({
        image: calculation.image,
        entityLabel: 'Kit',
        code: calculation.kitCode,
        description: descriptionWithoutUser(calculation.kitDescription),
        width: 64,
        height: 48,
        expandable: true,
      }),
    );
    cell(row, calculation.kitCode, 'font-weight:600;color:var(--accent)');
    cell(
      row,
      descriptionWithoutUser(calculation.kitDescription),
      'color:var(--text2);font-size:12px;max-width:220px',
    );
    cell(row, calculation.reference || '—', 'color:var(--text2);font-size:12px');
    const profileCell = row.insertCell();
    const tag = document.createElement('span');
    tag.className = `tag ${profileTagClass(calculation)}`;
    tag.textContent = calculation.priceList.name;
    profileCell.append(tag);
    cell(
      row,
      money(calculation.minimumTotal),
      'text-align:right;font-weight:600;color:#ff6b00',
    ).classList.add('reference-price');
    cell(
      row,
      money(calculation.normalTotal),
      'text-align:right;font-weight:600;color:var(--accent)',
    ).classList.add('reference-price');
    cell(row, dateTime(calculation.createdAt), 'color:var(--text2);font-size:12px');
    cell(row, calculation.createdBy, 'font-size:12px;color:var(--text2)');
    const actionCell = row.insertCell();
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-xs';
    button.textContent = 'Ver';
    button.dataset.calculationId = calculation.id;
    button.addEventListener('click', () => {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.history.pushState(
        null,
        '',
        `/calculos/${encodeURIComponent(calculation.id)}?returnTo=${encodeURIComponent(returnTo)}`,
      );
      window.show('detalhe');
    });
    actionCell.append(button);
  }
}

function renderMessage(title: string, message: string, retry = false): void {
  const body = element<HTMLTableSectionElement>('#busca-tbody');
  const row = body.insertRow();
  const td = row.insertCell();
  td.colSpan = 10;
  const container = document.createElement('div');
  container.className = 'empty';
  container.setAttribute('style', 'padding:48px 20px');
  const icon = document.createElement('div');
  icon.className = 'empty-ico';
  icon.textContent = retry ? 'Erro' : 'Busca';
  const heading = document.createElement('div');
  heading.className = 'empty-title';
  heading.textContent = title;
  const copy = document.createElement('div');
  copy.className = 'empty-txt';
  copy.textContent = message;
  container.append(icon, heading, copy);
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-sm';
    button.textContent = 'Tentar novamente';
    button.addEventListener('click', () => void load());
    container.append(button);
  }
  td.append(container);
}

function pageRange(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: Array<number | 'ellipsis'> = [1];
  if (current > 3) pages.push('ellipsis');
  for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1)
    pages.push(page);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function renderPagination(totalPages: number): void {
  const pagination = element<HTMLElement>('#busca-pg');
  pagination.replaceChildren();
  if (totalPages <= 1) return;
  const addButton = (label: string, page: number, active = false): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pg-btn${active ? ' on' : ''}`;
    button.textContent = label;
    button.disabled = page < 1 || page > totalPages;
    button.addEventListener('click', () => {
      state.page = page;
      writeState();
      void load();
    });
    pagination.append(button);
  };
  addButton('‹', state.page - 1);
  for (const page of pageRange(state.page, totalPages)) {
    if (page === 'ellipsis') {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'pg-info';
      ellipsis.textContent = '…';
      pagination.append(ellipsis);
    } else addButton(String(page), page, page === state.page);
  }
  addButton('›', state.page + 1);
}

function renderHeaders(): void {
  for (const [sort, id] of Object.entries(headerIds) as Array<[CalculationSearchSort, string]>) {
    const header = element<HTMLElement>(`#${id}`);
    const referencePrice = sort === 'minimumTotal' || sort === 'normalTotal';
    header.className =
      `sortable${referencePrice ? ' reference-price' : ''}` +
      `${state.sort === sort ? (state.direction === 'asc' ? ' sa' : ' sd') : ''}`;
  }
}

async function load(): Promise<void> {
  const sequence = ++requestSequence;
  const body = element<HTMLTableSectionElement>('#busca-tbody');
  body.replaceChildren();
  renderMessage('Carregando cálculos…', 'Consultando os resultados salvos.');
  element<HTMLElement>('#busca-table').setAttribute('aria-busy', 'true');
  try {
    const response = await listCalculations({ ...state, pageSize: PAGE_SIZE });
    if (sequence !== requestSequence) return;
    const { calculations, filters, pagination } = response.data;
    state.page = pagination.page;
    const select = element<HTMLSelectElement>('#busca-cli');
    const selected = state.priceListId;
    select.replaceChildren(new Option('Todos os perfis de preço', ''));
    for (const priceList of filters.priceLists)
      select.add(new Option(priceList.name, priceList.id));
    select.value = filters.priceLists.some(({ id }) => id === selected) ? selected : '';
    if (selected && !select.value) {
      state.priceListId = '';
      writeState();
    }
    body.replaceChildren();
    element<HTMLElement>('#busca-count').textContent =
      `${pagination.total} cálculo${pagination.total === 1 ? '' : 's'} ` +
      `encontrado${pagination.total === 1 ? '' : 's'}`;
    if (calculations.length) renderRows(calculations);
    else
      renderMessage(
        'Nenhum cálculo encontrado',
        state.search || state.priceListId
          ? 'Nenhum cálculo corresponde aos filtros informados.'
          : 'Quando um cálculo for salvo, ele aparecerá aqui.',
      );
    renderPagination(pagination.totalPages);
    renderHeaders();
  } catch (error) {
    if (sequence !== requestSequence) return;
    body.replaceChildren();
    element<HTMLElement>('#busca-count').textContent = '';
    element<HTMLElement>('#busca-pg').replaceChildren();
    renderMessage(
      'Não foi possível carregar os cálculos',
      error instanceof Error ? error.message : 'Tente novamente em alguns instantes.',
      true,
    );
  } finally {
    if (sequence === requestSequence)
      element<HTMLElement>('#busca-table').setAttribute('aria-busy', 'false');
  }
}

export function initializeSearchPage(): void {
  if (initialized) return;
  initialized = true;
  const input = element<HTMLInputElement>('#busca-q');
  const select = element<HTMLSelectElement>('#busca-cli');
  input.addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      state.search = input.value.trim();
      state.page = 1;
      writeState();
      void load();
    }, 300);
  });
  select.addEventListener('change', () => {
    state.priceListId = select.value;
    state.page = 1;
    writeState();
    void load();
  });
  for (const [sort, id] of Object.entries(headerIds) as Array<[CalculationSearchSort, string]>) {
    element<HTMLElement>(`#${id}`).addEventListener('click', () => {
      if (state.sort === sort) state.direction = state.direction === 'asc' ? 'desc' : 'asc';
      else {
        state.sort = sort;
        state.direction = 'asc';
      }
      state.page = 1;
      writeState();
      void load();
    });
  }
}

export function showSearchPage(): void {
  state = readState();
  element<HTMLInputElement>('#busca-q').value = state.search;
  renderHeaders();
  void load();
}
