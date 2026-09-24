import type { AuthenticatedUser } from '../shared/auth.js';
import type { CustomerClass, CustomerSegment } from '../shared/customers.js';
import type {
  CreatePriceListInput,
  PriceListDto,
  PriceListImportPreview,
  PriceListStructureEnvelope,
  PriceListTypeCode,
  SpreadsheetDiagnostic,
  UpdatePriceListInput,
} from '../shared/pricing.js';
import { ApiError } from './services/api.js';
import { listCustomerClassifications } from './services/customers-api.js';
import {
  confirmPriceListImport,
  createPriceList,
  getPriceListStructure,
  listPriceLists,
  previewPriceListImport,
  setPriceListActive,
  updatePriceList,
} from './services/price-lists-api.js';

interface PendingImport {
  file: File;
  preview?: PriceListImportPreview;
  error?: string;
  busy?: boolean;
}

let initialized = false;
let currentUser: AuthenticatedUser | null = null;
let priceLists: PriceListDto[] = [];
let customerClasses: CustomerClass[] = [];
let customerSegments: CustomerSegment[] = [];
let editingId: string | null = null;
let loading = false;
let classificationsWarning = '';
const pendingImports = new Map<string, PendingImport>();
let structureListId: string | null = null;
let structurePage = 1;
let structureSearch = '';
let structureRequest = 0;

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function canManage(): boolean {
  return Boolean(currentUser?.permissions.includes('matrix.manage'));
}

function typeLabel(type: PriceListTypeCode): string {
  return type === 'KIT_COMPONENT' ? 'Kit com estrutura' : 'Produto sem estrutura';
}

function rangeLabel(list: PriceListDto): string {
  const minimum = list.minimumOrderQuantity;
  const maximum = list.maximumOrderQuantity;
  if (minimum === null && maximum === null) return 'Sem faixa de quantidade';
  if (minimum !== null && maximum !== null) return `${minimum} a ${maximum} unidades`;
  if (minimum !== null) return `A partir de ${minimum} unidades`;
  return `Até ${maximum} unidades`;
}

function audienceLabel(list: PriceListDto): string {
  const audience = list.type === 'KIT_COMPONENT' ? list.customerClasses : list.customerSegments;
  return audience.length > 0
    ? audience.map(({ name }) => name).join(', ')
    : 'Nenhum público definido';
}

function feedback(message: string, isError = false): void {
  const box = element<HTMLElement>('#price-lists-feedback');
  box.textContent = message;
  box.classList.toggle('is-error', isError);
  box.hidden = !message;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'O sistema está temporariamente indisponível. Tente novamente.';
}

function diagnosticMarkup(diagnostic: SpreadsheetDiagnostic): string {
  const location = [
    diagnostic.row ? `linha ${diagnostic.row}` : '',
    diagnostic.column ? `coluna ${diagnostic.column}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return `<li><strong>${escapeHtml(diagnostic.code)}</strong>${location ? ` (${location})` : ''}: ${escapeHtml(diagnostic.message)}</li>`;
}

function importMarkup(list: PriceListDto): string {
  if (!canManage()) return '';
  const pending = pendingImports.get(list.id);
  const preview = pending?.preview;
  const errors = preview?.errors ?? [];
  const warnings = preview?.warnings ?? [];
  return `<div class="price-list-import" data-import-panel="${list.id}">
    <label class="btn btn-ghost btn-xs price-list-file-label">
      Selecionar planilha
      <input type="file" accept=".xls,.xlsx" data-list-file="${list.id}">
    </label>
    <span class="price-list-file-name">${pending ? escapeHtml(pending.file.name) : 'Nenhum arquivo selecionado'}</span>
    <button class="btn btn-ghost btn-xs" type="button" data-action="preview" data-id="${list.id}" ${!pending || pending.busy ? 'disabled' : ''}>${pending?.busy && !preview ? 'Analisando…' : 'Analisar arquivo'}</button>
    ${pending?.error ? `<div class="price-list-inline-error" role="alert">${escapeHtml(pending.error)}</div>` : ''}
    ${
      preview
        ? `<div class="price-list-preview ${preview.valid ? 'is-valid' : 'is-invalid'}" data-preview-for="${list.id}">
          <div class="price-list-preview-head"><strong>Prévia da importação</strong><span>${preview.itemCount} ${preview.itemCount === 1 ? 'item válido' : 'itens válidos'}</span></div>
          <div class="price-list-preview-hash">Hash: ${escapeHtml(preview.fileHash)}</div>
          ${errors.length ? `<div class="price-list-diagnostics errors"><strong>${errors.length} erro(s)</strong><ul>${errors.map(diagnosticMarkup).join('')}</ul></div>` : ''}
          ${warnings.length ? `<div class="price-list-diagnostics warnings"><strong>${warnings.length} aviso(s)</strong><ul>${warnings.map(diagnosticMarkup).join('')}</ul></div>` : ''}
          <p class="price-list-preview-note">A prévia não altera a versão ativa. Confirme abaixo para importar e ativar esta versão.</p>
          <button class="btn btn-primary btn-xs" type="button" data-action="confirm-import" data-id="${list.id}" ${!preview.valid || pending?.busy ? 'disabled' : ''}>${pending?.busy ? 'Importando…' : 'Confirmar importação e ativar'}</button>
        </div>`
        : ''
    }
  </div>`;
}

function cardMarkup(list: PriceListDto): string {
  const version = list.activeVersion;
  return `<article class="card price-list-card ${list.active ? '' : 'is-inactive'}" data-price-list="${list.id}">
    <div class="price-list-card-head">
      <div><div class="price-list-code">${escapeHtml(list.code)}</div><h3>${escapeHtml(list.name)}</h3></div>
      <span class="tag ${list.active ? 'tag-green' : 'tag-gray'}">${list.active ? 'Ativa' : 'Inativa'}</span>
    </div>
    <dl class="price-list-details">
      <div><dt>Tipo</dt><dd>${typeLabel(list.type)}</dd></div>
      <div><dt>Público</dt><dd>${escapeHtml(audienceLabel(list))}</dd></div>
      <div><dt>Faixa</dt><dd>${rangeLabel(list)}</dd></div>
      <div><dt>Versão ativa</dt><dd>${version ? `v${version.version} · ${escapeHtml(version.fileName)} · ${version.itemCount} itens` : '<span class="price-list-no-version">Nenhuma versão ativa</span>'}</dd></div>
    </dl>
    ${
      canManage()
        ? `<div class="price-list-actions">
          ${version ? `<button class="btn btn-ghost btn-xs" type="button" data-action="structure" data-id="${list.id}">Ver estrutura carregada</button>` : ''}
          <button class="btn btn-ghost btn-xs" type="button" data-action="edit" data-id="${list.id}">Editar definição</button>
          <button class="btn btn-ghost btn-xs" type="button" data-action="toggle-status" data-id="${list.id}">${list.active ? 'Desativar' : 'Ativar'}</button>
        </div>`
        : ''
    }
    ${importMarkup(list)}
  </article>`;
}

function structureCell(value: string | null): string {
  return value === null || value === '' ? '—' : escapeHtml(value);
}

function structureMoney(value: string | null): string {
  if (value === null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function structurePercentage(value: string | null): string {
  if (value === null || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(number)}%`;
}

function structureTable(response: PriceListStructureEnvelope): string {
  const { priceList, items } = response.data;
  if (!items.length) return '<div class="price-list-structure-state">Nenhum item encontrado.</div>';
  const kit = priceList.type === 'KIT_COMPONENT';
  const headings = kit
    ? '<th>Linha</th><th>Código</th><th>Descrição</th><th>Preço mínimo</th><th>Preço máximo</th>'
    : '<th>Linha</th><th>Código</th><th>Descrição</th><th>Referência</th><th>Valor</th><th>IPI</th><th>ICMS</th>';
  const rows = items
    .map((item) =>
      kit
        ? `<tr><td>${item.sourceRow}</td><td class="price-list-structure-code">${escapeHtml(item.code)}</td><td>${structureCell(item.description)}</td><td class="price-list-structure-number reference-price">${structureMoney(item.minimumPrice)}</td><td class="price-list-structure-number reference-price">${structureMoney(item.normalPrice)}</td></tr>`
        : `<tr><td>${item.sourceRow}</td><td class="price-list-structure-code">${escapeHtml(item.code)}</td><td>${structureCell(item.description)}</td><td>${structureCell(item.reference)}</td><td class="price-list-structure-number">${structureMoney(item.unitPrice)}</td><td class="price-list-structure-number">${structurePercentage(item.ipiRate)}</td><td class="price-list-structure-number">${structurePercentage(item.icmsRate)}</td></tr>`,
    )
    .join('');
  return `<table class="tbl price-list-structure-table"><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadStructure(): Promise<void> {
  if (!structureListId) return;
  const request = ++structureRequest;
  const content = element<HTMLElement>('#price-list-structure-content');
  const pagination = element<HTMLElement>('#price-list-structure-pagination');
  content.innerHTML = '<div class="price-list-structure-state">Carregando estrutura…</div>';
  pagination.hidden = true;
  try {
    const response = await getPriceListStructure(structureListId, {
      search: structureSearch,
      page: structurePage,
      pageSize: 50,
    });
    if (request !== structureRequest) return;
    const { priceList, version } = response.data;
    element<HTMLElement>('#price-list-structure-title').textContent = priceList.name;
    element<HTMLElement>('#price-list-structure-subtitle').textContent =
      `${priceList.code} · versão v${version.version} · ${response.pagination.total} item(ns)`;
    content.innerHTML = structureTable(response);
    pagination.hidden = response.pagination.totalPages <= 1;
    element<HTMLElement>('#price-list-structure-page').textContent =
      `Página ${response.pagination.page} de ${response.pagination.totalPages}`;
    element<HTMLButtonElement>('#price-list-structure-prev').disabled =
      response.pagination.page <= 1;
    element<HTMLButtonElement>('#price-list-structure-next').disabled =
      response.pagination.page >= response.pagination.totalPages;
  } catch (error) {
    if (request !== structureRequest) return;
    content.innerHTML = `<div class="price-list-structure-state">${escapeHtml(errorMessage(error))}</div>`;
  }
}

function openStructure(id: string): void {
  if (!canManage()) return;
  structureListId = id;
  structurePage = 1;
  structureSearch = '';
  element<HTMLInputElement>('#price-list-structure-search').value = '';
  element<HTMLElement>('#price-list-structure-title').textContent = 'Estrutura carregada';
  element<HTMLElement>('#price-list-structure-subtitle').textContent = '';
  element<HTMLElement>('#price-list-structure-modal').classList.add('open');
  void loadStructure();
}

function closeStructure(): void {
  structureListId = null;
  structureRequest += 1;
  element<HTMLElement>('#price-list-structure-modal').classList.remove('open');
}

function sectionMarkup(
  title: string,
  description: string,
  lists: PriceListDto[],
  section: string,
): string {
  return `<section class="price-list-section" aria-labelledby="price-lists-${section}-title">
    <div class="price-list-section-head"><div><h2 id="price-lists-${section}-title">${title}</h2><p>${description}</p></div><span class="tag tag-gray">${lists.length}</span></div>
    <div class="price-list-grid" data-price-list-section="${section}">
      ${lists.length ? lists.map(cardMarkup).join('') : '<div class="price-list-empty">Nenhuma lista cadastrada neste tipo.</div>'}
    </div>
  </section>`;
}

function render(): void {
  const root = element<HTMLElement>('#price-lists-content');
  element<HTMLButtonElement>('#price-lists-add').hidden = !canManage();
  if (loading) {
    root.innerHTML = '<div class="price-list-state">Carregando listas de preço…</div>';
    return;
  }
  const ordered = [...priceLists].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR'),
  );
  const kits = ordered.filter(({ type }) => type === 'KIT_COMPONENT');
  const products = ordered.filter(({ type }) => type === 'STANDALONE_PRODUCT');
  root.innerHTML = `${
    classificationsWarning && canManage()
      ? `<div class="price-list-warning" role="status">${escapeHtml(classificationsWarning)}</div>`
      : ''
  }${sectionMarkup('Kits com estrutura', 'Listas de componentes usadas para calcular a estrutura de kits.', kits, 'kits')}${sectionMarkup('Produtos sem estrutura', 'Listas de preços finais para produtos vendidos sem composição.', products, 'products')}`;
}

async function load(): Promise<void> {
  if (loading) return;
  loading = true;
  render();
  try {
    const [listsResult, classificationsResult] = await Promise.allSettled([
      listPriceLists(),
      canManage() ? listCustomerClassifications() : Promise.resolve(null),
    ]);
    if (listsResult.status === 'rejected') throw listsResult.reason;
    priceLists = listsResult.value.data.priceLists;
    classificationsWarning = '';
    if (classificationsResult.status === 'fulfilled' && classificationsResult.value) {
      customerClasses = classificationsResult.value.data.customerClasses;
      customerSegments = classificationsResult.value.data.customerSegments;
    } else if (classificationsResult.status === 'rejected') {
      customerClasses = uniqueAudience(priceLists.flatMap(({ customerClasses: items }) => items));
      customerSegments = uniqueAudience(priceLists.flatMap(({ customerSegments: items }) => items));
      classificationsWarning =
        'Não foi possível carregar todos os públicos. As listas continuam disponíveis; tente atualizar antes de criar uma nova definição.';
    }
  } catch (error) {
    priceLists = [];
    feedback(errorMessage(error), true);
  } finally {
    loading = false;
    render();
  }
}

function uniqueAudience<T extends CustomerClass | CustomerSegment>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function selectedValues(name: string): string[] {
  return [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map(
    ({ value }) => value,
  );
}

function renderAudience(type: PriceListTypeCode, selected: string[] = []): void {
  const container = element<HTMLElement>('#price-list-audience-options');
  const options = type === 'KIT_COMPONENT' ? customerClasses : customerSegments;
  element<HTMLElement>('#price-list-audience-label').textContent =
    type === 'KIT_COMPONENT' ? 'Classes de clientes' : 'Segmentos de clientes';
  container.innerHTML = options.length
    ? options
        .map(
          (option) =>
            `<label class="price-list-audience-option"><input type="checkbox" name="priceListAudience" value="${option.id}" ${selected.includes(option.id) ? 'checked' : ''}><span><strong>${escapeHtml(option.name)}</strong><small>${escapeHtml(option.code)}</small></span></label>`,
        )
        .join('')
    : '<div class="price-list-audience-empty">Nenhum público ativo disponível.</div>';
}

function openForm(list?: PriceListDto): void {
  editingId = list?.id ?? null;
  const form = element<HTMLFormElement>('#price-list-form');
  form.reset();
  element<HTMLElement>('#price-list-form-title').textContent = list
    ? 'Editar lista de preço'
    : 'Nova lista de preço';
  const code = element<HTMLInputElement>('#price-list-code');
  const type = element<HTMLSelectElement>('#price-list-type');
  code.value = list?.code ?? '';
  code.disabled = Boolean(list);
  type.value = list?.type ?? 'KIT_COMPONENT';
  type.disabled = Boolean(list);
  element<HTMLInputElement>('#price-list-name').value = list?.name ?? '';
  element<HTMLInputElement>('#price-list-minimum').value = String(list?.minimumOrderQuantity ?? '');
  element<HTMLInputElement>('#price-list-maximum').value = String(list?.maximumOrderQuantity ?? '');
  const selected = list
    ? (list.type === 'KIT_COMPONENT' ? list.customerClasses : list.customerSegments).map(
        ({ id }) => id,
      )
    : [];
  renderAudience(type.value as PriceListTypeCode, selected);
  setFormError('');
  element<HTMLButtonElement>('#price-list-form-submit').textContent = list
    ? 'Salvar alterações'
    : 'Criar lista';
  element<HTMLElement>('#price-list-form-modal').classList.add('open');
  element<HTMLInputElement>('#price-list-name').focus();
}

function closeForm(): void {
  if (element<HTMLFormElement>('#price-list-form').getAttribute('aria-busy') === 'true') return;
  element<HTMLElement>('#price-list-form-modal').classList.remove('open');
  editingId = null;
}

function setFormError(message: string): void {
  const error = element<HTMLElement>('#price-list-form-error');
  error.textContent = message;
  error.hidden = !message;
}

function optionalInteger(selector: string): number | null | undefined {
  const input = element<HTMLInputElement>(selector);
  if (!input.value.trim()) return null;
  const parsed = Number(input.value);
  if (!Number.isInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

async function submitForm(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = element<HTMLFormElement>('#price-list-form');
  if (form.getAttribute('aria-busy') === 'true') return;
  setFormError('');
  const name = element<HTMLInputElement>('#price-list-name').value.trim();
  const type = element<HTMLSelectElement>('#price-list-type').value as PriceListTypeCode;
  const minimumOrderQuantity = optionalInteger('#price-list-minimum');
  const maximumOrderQuantity = optionalInteger('#price-list-maximum');
  if (!name) return setFormError('Informe o nome da lista.');
  if (minimumOrderQuantity === undefined || maximumOrderQuantity === undefined)
    return setFormError('A faixa deve usar números inteiros não negativos.');
  if (
    minimumOrderQuantity !== null &&
    maximumOrderQuantity !== null &&
    minimumOrderQuantity > maximumOrderQuantity
  )
    return setFormError('A quantidade mínima não pode superar a máxima.');
  const audienceIds = selectedValues('priceListAudience');
  const audience =
    type === 'KIT_COMPONENT'
      ? { customerClassIds: audienceIds, customerSegmentIds: [] }
      : { customerClassIds: [], customerSegmentIds: audienceIds };
  form.setAttribute('aria-busy', 'true');
  element<HTMLButtonElement>('#price-list-form-submit').disabled = true;
  try {
    if (editingId) {
      const input: UpdatePriceListInput = {
        name,
        minimumOrderQuantity,
        maximumOrderQuantity,
        ...audience,
      };
      await updatePriceList(editingId, input);
      feedback('Lista atualizada com sucesso.');
    } else {
      const code = element<HTMLInputElement>('#price-list-code').value.trim().toUpperCase();
      if (!code) return setFormError('Informe o código da lista.');
      const input: CreatePriceListInput = {
        code,
        name,
        type,
        minimumOrderQuantity,
        maximumOrderQuantity,
        ...audience,
      };
      await createPriceList(input);
      feedback('Lista criada com sucesso.');
    }
    element<HTMLElement>('#price-list-form-modal').classList.remove('open');
    editingId = null;
    await load();
  } catch (error) {
    setFormError(errorMessage(error));
  } finally {
    form.setAttribute('aria-busy', 'false');
    element<HTMLButtonElement>('#price-list-form-submit').disabled = false;
  }
}

async function toggleStatus(id: string): Promise<void> {
  const list = priceLists.find((item) => item.id === id);
  if (!list) return;
  const verb = list.active ? 'desativar' : 'ativar';
  if (!window.confirm(`Deseja ${verb} a lista “${list.name}”?`)) return;
  try {
    await setPriceListActive(id, !list.active);
    feedback(`Lista ${list.active ? 'desativada' : 'ativada'} com sucesso.`);
    await load();
  } catch (error) {
    feedback(errorMessage(error), true);
  }
}

async function previewImport(id: string): Promise<void> {
  const pending = pendingImports.get(id);
  if (!pending || pending.busy) return;
  pending.busy = true;
  delete pending.error;
  delete pending.preview;
  render();
  try {
    pending.preview = (await previewPriceListImport(id, pending.file)).data.preview;
  } catch (error) {
    pending.error = errorMessage(error);
  } finally {
    pending.busy = false;
    render();
  }
}

async function confirmImport(id: string): Promise<void> {
  const pending = pendingImports.get(id);
  if (!pending?.preview?.valid || pending.busy) return;
  pending.busy = true;
  delete pending.error;
  render();
  try {
    const imported = await confirmPriceListImport(id, pending.file, pending.preview.fileHash);
    pendingImports.delete(id);
    feedback(`Versão v${imported.data.imported.version.version} importada e ativada com sucesso.`);
    await load();
  } catch (error) {
    pending.busy = false;
    pending.error = errorMessage(error);
    render();
  }
}

function handleContentClick(event: MouseEvent): void {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button || button.disabled) return;
  const id = button.dataset.id;
  if (!id) return;
  if (button.dataset.action === 'edit') {
    const list = priceLists.find((item) => item.id === id);
    if (list) openForm(list);
  } else if (button.dataset.action === 'structure') openStructure(id);
  else if (button.dataset.action === 'toggle-status') void toggleStatus(id);
  else if (button.dataset.action === 'preview') void previewImport(id);
  else if (button.dataset.action === 'confirm-import') void confirmImport(id);
}

function handleFileChange(event: Event): void {
  const input = (event.target as Element).closest<HTMLInputElement>('input[data-list-file]');
  const id = input?.dataset.listFile;
  const file = input?.files?.[0];
  if (!id) return;
  if (file) pendingImports.set(id, { file });
  else pendingImports.delete(id);
  render();
}

export function showPriceListsPage(user: AuthenticatedUser): void {
  currentUser = user;
  feedback('');
  void load();
}

export function initializePriceListsPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLButtonElement>('#price-lists-refresh').addEventListener('click', () => void load());
  element<HTMLButtonElement>('#price-lists-add').addEventListener('click', () => openForm());
  element<HTMLElement>('#price-lists-content').addEventListener('click', handleContentClick);
  element<HTMLElement>('#price-lists-content').addEventListener('change', handleFileChange);
  element<HTMLSelectElement>('#price-list-type').addEventListener('change', (event) =>
    renderAudience((event.target as HTMLSelectElement).value as PriceListTypeCode),
  );
  element<HTMLFormElement>('#price-list-form').addEventListener(
    'submit',
    (event) => void submitForm(event),
  );
  element<HTMLButtonElement>('#price-list-form-close').addEventListener('click', closeForm);
  element<HTMLButtonElement>('#price-list-form-cancel').addEventListener('click', closeForm);
  element<HTMLButtonElement>('#price-list-structure-close').addEventListener(
    'click',
    closeStructure,
  );
  element<HTMLFormElement>('#price-list-structure-search-form').addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      structureSearch = element<HTMLInputElement>('#price-list-structure-search').value.trim();
      structurePage = 1;
      void loadStructure();
    },
  );
  element<HTMLButtonElement>('#price-list-structure-prev').addEventListener('click', () => {
    if (structurePage <= 1) return;
    structurePage -= 1;
    void loadStructure();
  });
  element<HTMLButtonElement>('#price-list-structure-next').addEventListener('click', () => {
    structurePage += 1;
    void loadStructure();
  });
}
