import type { AuthenticatedUser } from '../shared/auth.js';
import type { CatalogFilter, CatalogItem } from '../shared/catalog.js';
import type { SavedKitCompositionItem } from '../shared/orders.js';
import { createMediaImage } from './components/media-image.js';
import { ApiError } from './services/api.js';
import { loadCatalog, removeCatalogImage, uploadCatalogImage } from './services/catalog-api.js';
import { loadSavedKitComposition } from './services/orders-api.js';

const PAGE_SIZE = 30;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
let initialized = false;
let currentUser: AuthenticatedUser | null = null;
let items: CatalogItem[] = [];
let page = 1;
let totalPages = 1;
let debounceTimer = 0;
let requestSequence = 0;
let editingItem: CatalogItem | null = null;
let selectedFile: File | null = null;
let previewUrl: string | null = null;
let submittingImage = false;

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function canManage(): boolean {
  return Boolean(currentUser?.permissions.includes('catalog.manage'));
}

function canViewCustomers(): boolean {
  return Boolean(
    currentUser?.permissions.some(
      (permission) => permission === 'customer.view' || permission === 'customer.manage',
    ),
  );
}

function feedback(message: string, isError = false): void {
  const box = element<HTMLElement>('#products-feedback');
  box.textContent = message;
  box.classList.toggle('is-error', isError);
  box.hidden = !message;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível concluir a operação.';
}

function closeModal(selector: string): void {
  element<HTMLElement>(selector).classList.remove('open');
}

function renderMessage(title: string, copy: string): void {
  const body = element<HTMLTableSectionElement>('#products-tbody');
  body.replaceChildren();
  const cell = body.insertRow().insertCell();
  cell.colSpan = 7;
  const empty = document.createElement('div');
  empty.className = 'empty products-empty';
  const heading = document.createElement('div');
  heading.className = 'empty-title';
  heading.textContent = title;
  const text = document.createElement('div');
  text.className = 'empty-txt';
  text.textContent = copy;
  empty.append(heading, text);
  cell.append(empty);
}

function appendCell(row: HTMLTableRowElement, text: string, className = ''): HTMLTableCellElement {
  const cell = row.insertCell();
  cell.textContent = text;
  cell.className = className;
  return cell;
}

function formatNumber(value: string, currency = false): string {
  return new Intl.NumberFormat(
    'pt-BR',
    currency ? { style: 'currency', currency: 'BRL' } : { maximumFractionDigits: 4 },
  ).format(Number(value));
}

function renderCompositionItem(item: SavedKitCompositionItem, body: HTMLTableSectionElement): void {
  const row = body.insertRow();
  appendCell(row, item.code, 'products-code');
  appendCell(row, item.description, 'products-description');
  appendCell(row, formatNumber(item.quantity), 'number');
  appendCell(row, item.unit);
  appendCell(
    row,
    item.hasPrice ? formatNumber(item.minimumUnitPrice, true) : 'Sem preço',
    'number',
  );
  appendCell(row, item.hasPrice ? formatNumber(item.minimumTotal, true) : '—', 'number');
  appendCell(row, item.hasPrice ? formatNumber(item.normalUnitPrice, true) : 'Sem preço', 'number');
  appendCell(row, item.hasPrice ? formatNumber(item.normalTotal, true) : '—', 'number');
}

function navigateToCustomer(customerId: string): void {
  const query = new URLSearchParams({ cliente: customerId, aba: 'kits' });
  closeModal('#products-composition-modal');
  window.history.pushState(null, '', `/clientes?${query.toString()}`);
  window.show('clientes');
}

async function openComposition(item: Extract<CatalogItem, { kind: 'KIT' }>): Promise<void> {
  const modal = element<HTMLElement>('#products-composition-modal');
  element<HTMLElement>('#products-composition-title').textContent =
    `Composição do kit ${item.code}`;
  element<HTMLElement>('#products-composition-subtitle').textContent = item.description;
  const customers = element<HTMLElement>('#products-composition-customers');
  const body = element<HTMLElement>('#products-composition-body');
  customers.replaceChildren();
  body.textContent = 'Carregando composição…';
  body.classList.add('products-composition-state');
  modal.dataset.calculationId = item.compositionCalculationId;
  modal.classList.add('open');
  try {
    const response = await loadSavedKitComposition(item.compositionCalculationId);
    if (modal.dataset.calculationId !== item.compositionCalculationId) return;
    customers.replaceChildren();
    for (const customer of response.data.kit.customers) {
      const chip = document.createElement(canViewCustomers() ? 'a' : 'span');
      chip.className = `products-customer${canViewCustomers() ? ' products-customer-link' : ''}`;
      if (chip instanceof HTMLAnchorElement) {
        chip.href = `/clientes?cliente=${encodeURIComponent(customer.id)}&aba=kits`;
        chip.title = `Visualizar cliente ${customer.legalName}`;
        chip.addEventListener('click', (event) => {
          event.preventDefault();
          navigateToCustomer(customer.id);
        });
      }
      chip.textContent = `${customer.code} · ${customer.legalName}`;
      customers.append(chip);
    }
    if (!response.data.kit.customers.length) customers.textContent = 'Nenhum cliente vinculado';
    body.replaceChildren();
    body.classList.remove('products-composition-state');
    if (!response.data.kit.items.length) {
      body.textContent = 'Este kit não possui produtos na composição.';
      body.classList.add('products-composition-state');
      return;
    }
    const table = document.createElement('table');
    table.className = 'products-composition-table';
    const header = table.createTHead().insertRow();
    for (const label of [
      'Código',
      'Descrição',
      'Qtde.',
      'UM',
      'Preço mín.',
      'Total mín.',
      'Preço máx.',
      'Total máx.',
    ]) {
      const cell = document.createElement('th');
      cell.textContent = label;
      header.append(cell);
    }
    const tableBody = table.createTBody();
    for (const compositionItem of response.data.kit.items)
      renderCompositionItem(compositionItem, tableBody);
    body.append(table);
  } catch (error) {
    body.textContent = errorMessage(error);
    body.classList.add('products-composition-state');
  }
}

function clearPreview(): void {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  selectedFile = null;
  element<HTMLInputElement>('#products-photo-file').value = '';
  element<HTMLElement>('#products-photo-preview').replaceChildren();
}

function setPhotoState(message: string, isError = false): void {
  const state = element<HTMLElement>('#products-photo-state');
  state.textContent = message;
  state.classList.toggle('is-error', isError);
  state.hidden = !message;
}

function mediaImage(item: CatalogItem, width: number, height: number): HTMLElement {
  return createMediaImage({
    image: item.image,
    entityLabel: item.kind === 'KIT' ? 'Kit' : 'Produto',
    code: item.code,
    description: item.description,
    width,
    height,
  });
}

function openPhoto(item: CatalogItem): void {
  editingItem = item;
  clearPreview();
  setPhotoState('');
  element<HTMLElement>('#products-photo-title').textContent =
    `${item.image ? 'Trocar' : 'Adicionar'} foto — ${item.code}`;
  element<HTMLElement>('#products-photo-preview').append(mediaImage(item, 220, 160));
  element<HTMLButtonElement>('#products-photo-remove').hidden = !item.image;
  element<HTMLButtonElement>('#products-photo-save').disabled = true;
  element<HTMLElement>('#products-photo-modal').classList.add('open');
}

function selectPhoto(file: File | undefined): void {
  setPhotoState('');
  if (!file) return;
  if (!IMAGE_TYPES.has(file.type)) {
    setPhotoState('Use uma imagem JPEG, PNG ou WebP.', true);
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    setPhotoState('A imagem deve ter no máximo 5 MB.', true);
    return;
  }
  clearPreview();
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  const image = document.createElement('img');
  image.src = previewUrl;
  image.alt = `Prévia de ${file.name}`;
  image.className = 'products-photo-preview-image';
  element<HTMLElement>('#products-photo-preview').append(image);
  element<HTMLButtonElement>('#products-photo-save').disabled = false;
  setPhotoState(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
}

function setPhotoSubmitting(value: boolean): void {
  submittingImage = value;
  element<HTMLButtonElement>('#products-photo-save').disabled = value || !selectedFile;
  element<HTMLButtonElement>('#products-photo-remove').disabled = value;
  element<HTMLInputElement>('#products-photo-file').disabled = value;
}

async function savePhoto(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (submittingImage || !editingItem || !selectedFile) return;
  setPhotoSubmitting(true);
  setPhotoState('Enviando imagem…');
  try {
    await uploadCatalogImage(
      editingItem.kind === 'KIT' ? 'kits' : 'products',
      editingItem.entityId,
      selectedFile,
    );
    closeModal('#products-photo-modal');
    clearPreview();
    feedback('Foto do catálogo atualizada com sucesso.');
    await load();
  } catch (error) {
    setPhotoState(errorMessage(error), true);
  } finally {
    setPhotoSubmitting(false);
  }
}

async function removePhoto(): Promise<void> {
  if (submittingImage || !editingItem?.image) return;
  if (!window.confirm(`Remover a foto atual de ${editingItem.code}? O histórico será preservado.`))
    return;
  setPhotoSubmitting(true);
  setPhotoState('Removendo foto…');
  try {
    await removeCatalogImage(
      editingItem.kind === 'KIT' ? 'kits' : 'products',
      editingItem.entityId,
    );
    closeModal('#products-photo-modal');
    clearPreview();
    feedback('Foto atual removida. O histórico foi preservado.');
    await load();
  } catch (error) {
    setPhotoState(errorMessage(error), true);
  } finally {
    setPhotoSubmitting(false);
  }
}

function render(): void {
  const body = element<HTMLTableSectionElement>('#products-tbody');
  body.replaceChildren();
  if (!items.length) {
    renderMessage(
      'Nenhum item encontrado',
      'Ajuste a busca ou o filtro para ver outros itens do catálogo.',
    );
    return;
  }
  for (const item of items) {
    const row = body.insertRow();
    const photo = row.insertCell();
    photo.className = 'products-photo-cell';
    photo.append(mediaImage(item, 72, 54));
    const type = row.insertCell();
    type.className = 'products-type';
    const badge = document.createElement('span');
    badge.className = `order-kind ${item.kind === 'KIT' ? 'kit' : 'product'}`;
    badge.textContent = item.kind === 'KIT' ? 'Kit' : 'Produto avulso';
    type.append(badge);
    appendCell(row, item.code, 'products-code');
    appendCell(row, item.description, 'products-description');
    appendCell(row, item.reference || '—', 'products-reference');
    appendCell(
      row,
      item.origins.map((origin) => origin.name).join(', ') || '—',
      'products-reference',
    );
    const actions = row.insertCell();
    actions.className = 'products-action';
    if (item.kind === 'KIT') {
      const view = document.createElement('button');
      view.type = 'button';
      view.className = 'btn btn-ghost btn-xs';
      view.textContent = 'Composição';
      view.addEventListener('click', () => void openComposition(item));
      actions.append(view);
    }
    if (canManage()) {
      const image = document.createElement('button');
      image.type = 'button';
      image.className = 'btn btn-ghost btn-xs';
      image.textContent = item.image ? 'Trocar foto' : 'Adicionar foto';
      image.addEventListener('click', () => openPhoto(item));
      actions.append(image);
    }
  }
}

function renderPagination(): void {
  const container = element<HTMLElement>('#products-pagination');
  container.replaceChildren();
  if (totalPages <= 1) return;
  const previous = document.createElement('button');
  previous.className = 'pg-btn';
  previous.textContent = '‹';
  previous.disabled = page <= 1;
  previous.addEventListener('click', () => {
    page -= 1;
    void load();
  });
  const label = document.createElement('span');
  label.className = 'pg-info';
  label.textContent = `Página ${page} de ${totalPages}`;
  const next = document.createElement('button');
  next.className = 'pg-btn';
  next.textContent = '›';
  next.disabled = page >= totalPages;
  next.addEventListener('click', () => {
    page += 1;
    void load();
  });
  container.append(previous, label, next);
}

async function load(): Promise<void> {
  const sequence = ++requestSequence;
  renderMessage('Carregando catálogo…', 'Consultando kits e produtos avulsos.');
  try {
    const response = await loadCatalog({
      search: element<HTMLInputElement>('#products-search').value.trim(),
      filter: element<HTMLSelectElement>('#products-filter').value as CatalogFilter,
      page,
      pageSize: PAGE_SIZE,
    });
    if (sequence !== requestSequence) return;
    items = response.data.items;
    page = response.pagination.page;
    totalPages = response.pagination.totalPages;
    element<HTMLElement>('#products-count').textContent =
      `${response.pagination.total} ${response.pagination.total === 1 ? 'item' : 'itens'}`;
    render();
    renderPagination();
  } catch (error) {
    if (sequence !== requestSequence) return;
    renderMessage('Não foi possível carregar', errorMessage(error));
  }
}

export function initializeProductsPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLInputElement>('#products-search').addEventListener('input', () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      page = 1;
      void load();
    }, 300);
  });
  element<HTMLSelectElement>('#products-filter').addEventListener('change', () => {
    page = 1;
    void load();
  });
  element<HTMLInputElement>('#products-photo-file').addEventListener('change', (event) =>
    selectPhoto((event.currentTarget as HTMLInputElement).files?.[0]),
  );
  element<HTMLFormElement>('#products-photo-form').addEventListener(
    'submit',
    (event) => void savePhoto(event),
  );
  element<HTMLButtonElement>('#products-photo-remove').addEventListener(
    'click',
    () => void removePhoto(),
  );
  document.querySelectorAll('[data-products-photo-close]').forEach((button) =>
    button.addEventListener('click', () => {
      if (!submittingImage) {
        closeModal('#products-photo-modal');
        clearPreview();
      }
    }),
  );
  document
    .querySelectorAll('[data-products-composition-close]')
    .forEach((button) =>
      button.addEventListener('click', () => closeModal('#products-composition-modal')),
    );
}

export function showProductsPage(user: AuthenticatedUser): void {
  currentUser = user;
  element<HTMLElement>('#products-manage-badge').hidden = !canManage();
  page = 1;
  feedback('');
  void load();
}
