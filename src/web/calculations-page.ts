import type { AuthenticatedUser } from '../shared/auth.js';
import type { Customer } from '../shared/customers.js';
import type { CalculationPreview, PriceListDto } from '../shared/pricing.js';
import { ApiError } from './services/api.js';
import { previewCalculation, saveCalculation } from './services/calculations-api.js';
import { listCustomers } from './services/customers-api.js';
import { listPriceLists } from './services/price-lists-api.js';
import {
  downloadCalculationWorkbook,
  type CalculationExportData,
  type ExportImageSource,
} from './calculation-export.js';

let priceLists: PriceListDto[] = [];
let selectedPriceListId: string | null = null;
let processFile: File | null = null;
let photoFile: File | null = null;
let photoObjectUrl: string | null = null;
let preview: CalculationPreview | null = null;
let selectedCustomer: Customer | null = null;
let customers: Customer[] = [];
let customerTimer: number | undefined;
let initialized = false;
let hideMissingPrices = false;
let currentUser: AuthenticatedUser | null = null;

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error('Elemento obrigatório ausente: ' + selector);
  return found;
}

function escapeHtml(value: string | number | boolean | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function apiMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}

function currency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function date(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

function componentLists(): PriceListDto[] {
  return priceLists.filter(
    (list) => list.type === 'KIT_COMPONENT' && list.active && Boolean(list.activeVersion),
  );
}

function selectedList(): PriceListDto | undefined {
  return priceLists.find((list) => list.id === selectedPriceListId);
}

function classNames(list: Pick<PriceListDto, 'customerClasses'>): string {
  return list.customerClasses.length
    ? list.customerClasses.map(({ name }) => name).join(', ')
    : 'Nenhuma classe autorizada';
}

function releasePhotoUrl(): void {
  if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
  photoObjectUrl = null;
}

function renderPhotoSelection(): void {
  const container = element<HTMLElement>('#calc-photo-preview');
  const status = element<HTMLElement>('#calc-photo-status');
  const remove = element<HTMLButtonElement>('#calc-photo-remove');
  if (photoFile && photoObjectUrl) {
    container.innerHTML =
      '<img src="' + escapeHtml(photoObjectUrl) + '" alt="Prévia da nova foto do kit">';
    status.textContent = preview?.currentKitImage
      ? 'Nova foto selecionada. Ao salvar, ela substituirá a foto atual e criará uma nova versão.'
      : 'Nova foto selecionada. Ela será salva junto da nova versão.';
    status.classList.toggle('is-replacement', Boolean(preview?.currentKitImage));
    remove.hidden = false;
    return;
  }
  const inherited = preview?.currentKitImage;
  if (inherited) {
    container.innerHTML =
      '<img src="' + escapeHtml(inherited.displayUrl) + '" alt="Foto atual do kit">';
    status.textContent = 'Este kit já possui foto. Ela será mantida se você não escolher outra.';
  } else {
    container.innerHTML = '<div class="calc-photo-placeholder">Sem foto selecionada</div>';
    status.textContent = 'JPEG, PNG ou WebP, até 5 MB. A foto é opcional.';
  }
  status.classList.remove('is-replacement');
  remove.hidden = true;
}

function clearSelectedPhoto(): void {
  releasePhotoUrl();
  photoFile = null;
  element<HTMLInputElement>('#calc-photo-input').value = '';
  renderPhotoSelection();
}

function updateReadyState(): void {
  const list = selectedList();
  const status = element<HTMLElement>('#calc-active-matrix');
  const button = element<HTMLButtonElement>('#calc-run');
  if (!list) {
    status.textContent = componentLists().length
      ? selectedCustomer
        ? 'A classe do cliente não possui uma lista única e ativa.'
        : 'Selecione o cliente para identificar a lista automaticamente.'
      : 'Nenhuma lista de componentes ativa possui versão disponível.';
    status.classList.add('missing');
  } else if (!list.activeVersion) {
    status.textContent = 'A lista escolhida não possui versão ativa.';
    status.classList.add('missing');
  } else {
    status.textContent =
      'Versão v' +
      list.activeVersion.version +
      ' · Classes: ' +
      classNames(list) +
      ' · ' +
      list.activeVersion.itemCount.toLocaleString('pt-BR') +
      ' produtos';
    status.classList.remove('missing');
  }
  button.disabled = !processFile || !selectedCustomer || !list?.activeVersion;
  element<HTMLElement>('#calc-gear-status').classList.toggle(
    'has-missing',
    componentLists().length === 0,
  );
}

function renderPriceListOptions(): void {
  const container = element<HTMLElement>('#calc-price-list-options');
  container.replaceChildren();
  const selected = selectedList();
  container.innerHTML = selected
    ? '<div class="cBtn on"><span class="cBadge">✓</span>' + escapeHtml(selected.name) + '</div>'
    : '<div class="customers-empty">Aguardando cliente compatível.</div>';
  updateReadyState();
}

function listCard(list: PriceListDto): HTMLElement {
  const card = document.createElement('article');
  const usable = list.active && Boolean(list.activeVersion);
  card.className = 'calc-matrix-card' + (usable ? ' is-active' : '');
  const version = list.activeVersion;
  card.innerHTML =
    '<div class="calc-matrix-head"><div><div class="calc-matrix-name">' +
    escapeHtml(list.name) +
    '</div><small>' +
    escapeHtml(list.code) +
    '</small></div><span class="tag ' +
    (usable ? 'tag-green' : 'tag-orange') +
    '">' +
    (version ? 'v' + version.version + ' ativa' : 'Sem versão') +
    '</span></div><div class="calc-matrix-meta">Classes: ' +
    escapeHtml(classNames(list)) +
    (version
      ? '<br>' +
        escapeHtml(version.fileName) +
        ' · ' +
        version.itemCount.toLocaleString('pt-BR') +
        ' produtos · ' +
        date(version.createdAt)
      : '<br>Esta lista não pode ser usada em uma simulação.') +
    '</div>';
  return card;
}

function renderListCards(): void {
  const lists = priceLists.filter((list) => list.type === 'KIT_COMPONENT');
  const container = element<HTMLElement>('#calc-matrix-cards');
  container.replaceChildren(...lists.map(listCard));
  if (!lists.length)
    container.innerHTML =
      '<div class="customers-empty">Nenhuma lista de componentes cadastrada.</div>';
}

async function loadPriceLists(): Promise<void> {
  const options = element<HTMLElement>('#calc-price-list-options');
  options.innerHTML = '<div class="customers-loading">Carregando listas…</div>';
  try {
    priceLists = (await listPriceLists()).data.priceLists;
    selectedPriceListId = null;
    renderPriceListOptions();
    renderListCards();
  } catch (error) {
    priceLists = [];
    selectedPriceListId = null;
    options.innerHTML = '<div class="customers-empty">' + escapeHtml(apiMessage(error)) + '</div>';
    element<HTMLElement>('#calc-matrix-cards').innerHTML = options.innerHTML;
    updateReadyState();
  }
}

function renderPreview(): void {
  if (!preview) return;
  const existing = preview.existing;
  const alreadySaved = Boolean(
    !photoFile &&
    existing &&
    existing.priceListVersionId === preview.priceListVersion.id &&
    existing.sourceFileHash === preview.sourceFileHash,
  );
  const bannerClass = alreadySaved ? ' calc-result-saved' : '';
  const bannerMessage = photoFile
    ? '<strong>Nova foto selecionada.</strong> O salvamento criará uma nova versão para preservar a foto anterior.'
    : alreadySaved
      ? '<strong>Cálculo já salvo.</strong> A versão v' +
        escapeHtml(existing!.version) +
        ' corresponde a esta folha e lista de preços.'
      : existing
        ? '<strong>Nova prévia não salva.</strong> Existe uma versão anterior, mas a folha ou a lista de preços foi alterada.'
        : '<strong>Prévia não salva.</strong> O kit será vinculado ao cliente selecionado ao salvar.';
  const saveLabel = photoFile
    ? existing
      ? 'Salvar nova versão'
      : 'Salvar cálculo'
    : alreadySaved
      ? 'Vincular cliente'
      : existing
        ? 'Salvar nova versão'
        : 'Salvar cálculo';
  const rows = preview.items
    .map(
      (item) =>
        '<tr class="' +
        (item.hasPrice ? '' : 'calc-no-price') +
        '" data-missing="' +
        String(!item.hasPrice) +
        '">' +
        '<td class="calc-table-code">' +
        escapeHtml(item.code) +
        '</td><td>' +
        escapeHtml(item.description) +
        '</td>' +
        '<td class="calc-table-number">' +
        item.quantity.toLocaleString('pt-BR') +
        '</td><td>' +
        escapeHtml(item.unit) +
        '</td>' +
        '<td class="calc-table-number reference-price">' +
        (item.minimumUnitPrice ? currency(item.minimumUnitPrice) : '—') +
        '</td>' +
        '<td class="calc-table-number reference-price">' +
        (item.minimumTotal ? currency(item.minimumTotal) : '—') +
        '</td>' +
        '<td class="calc-table-number reference-price">' +
        (item.normalUnitPrice ? currency(item.normalUnitPrice) : '—') +
        '</td>' +
        '<td class="calc-table-number reference-price">' +
        (item.normalTotal ? currency(item.normalTotal) : '—') +
        '</td></tr>',
    )
    .join('');
  const applicableImageUrl = photoObjectUrl ?? preview.image?.displayUrl ?? null;
  const imageMarkup = applicableImageUrl
    ? '<div class="calc-kit-image"><img src="' +
      escapeHtml(applicableImageUrl) +
      '" alt="Foto que será salva para o kit ' +
      escapeHtml(preview.kitCode) +
      '"><div class="calc-kit-image-label">Foto desta versão</div></div>'
    : '';
  const exportAction = currentUser?.permissions.includes('calculation.export')
    ? '<button class="btn btn-ghost btn-sm" id="calc-export" type="button">Exportar Excel</button>'
    : '';
  element<HTMLElement>('#calc-main').innerHTML =
    '<div class="calc-preview-banner' +
    bannerClass +
    '"><span>' +
    bannerMessage +
    '</span>' +
    '<div class="calc-preview-actions"><button class="btn btn-ghost btn-sm" id="calc-toggle-missing" type="button">Ocultar sem preço</button>' +
    exportAction +
    '<button class="btn btn-primary btn-sm" id="calc-open-save" type="button">' +
    saveLabel +
    '</button></div></div>' +
    '<div class="kitCard">' +
    imageMarkup +
    '<div class="kf"><div class="kfL">Código</div><div class="kfV code">' +
    escapeHtml(preview.kitCode) +
    '</div></div>' +
    '<div class="kf" style="flex:1;min-width:180px"><div class="kfL">Descrição</div><div class="kfV">' +
    escapeHtml(preview.kitDescription) +
    '</div></div>' +
    '<div class="kf"><div class="kfL">Lista</div><div class="kfV"><span class="cTag">' +
    escapeHtml(preview.priceList.name) +
    '</span></div></div>' +
    '<div class="kf"><div class="kfL">Classes</div><div class="kfV">' +
    escapeHtml(classNames(preview.priceList)) +
    '</div></div>' +
    '<div class="kf"><div class="kfL">Versão</div><div class="kfV">v' +
    preview.priceListVersion.version +
    '</div></div></div>' +
    '<div class="totGrid"><div class="tCard min reference-price"><div class="tLabel">Tabela mínima</div><div class="tVal">' +
    currency(preview.minimumTotal) +
    '</div></div>' +
    '<div class="tCard nor reference-price"><div class="tLabel">Valor máximo</div><div class="tVal">' +
    currency(preview.normalTotal) +
    '</div></div>' +
    '<div class="tCard inf"><div class="tLabel">Sem preço na lista</div><div class="tVal">' +
    preview.missingPriceCount +
    '</div><div class="tSub">de ' +
    preview.itemCount +
    ' itens</div></div></div>' +
    '<div class="tblCard"><div class="tbar"><div class="tbarT">Composição do kit</div></div><div class="calc-table-wrap"><table>' +
    '<thead><tr><th>Código</th><th>Descrição</th><th class="calc-table-number">Qtde</th><th>UM</th><th class="calc-table-number reference-price">Preço mín.</th>' +
    '<th class="calc-table-number reference-price">Total mín.</th><th class="calc-table-number reference-price">Preço máx.</th><th class="calc-table-number reference-price">Total máx.</th></tr></thead>' +
    '<tbody>' +
    rows +
    '</tbody><tfoot><tr><td colspan="4"><strong>Total geral</strong></td><td class="reference-price"></td><td class="calc-table-number reference-price"><strong>' +
    currency(preview.minimumTotal) +
    '</strong></td><td class="reference-price"></td><td class="calc-table-number reference-price"><strong>' +
    currency(preview.normalTotal) +
    '</strong></td></tr></tfoot></table></div></div>';
  hideMissingPrices = false;
  element<HTMLButtonElement>('#calc-toggle-missing').addEventListener('click', toggleMissing);
  const exportButton = document.querySelector<HTMLButtonElement>('#calc-export');
  exportButton?.addEventListener('click', () => void exportPreview(exportButton));
  element<HTMLButtonElement>('#calc-open-save').addEventListener('click', openSaveModal);
  renderPhotoSelection();
}

function toggleMissing(): void {
  hideMissingPrices = !hideMissingPrices;
  document.querySelectorAll<HTMLElement>('#calc-main tr[data-missing="true"]').forEach((row) => {
    row.hidden = hideMissingPrices;
  });
  element<HTMLButtonElement>('#calc-toggle-missing').textContent = hideMissingPrices
    ? 'Mostrar todos'
    : 'Ocultar sem preço';
}

async function runCalculation(): Promise<void> {
  if (!processFile || !selectedPriceListId || !selectedCustomer) return;
  const button = element<HTMLButtonElement>('#calc-run');
  button.disabled = true;
  button.textContent = 'Calculando…';
  try {
    preview = (await previewCalculation(selectedPriceListId, processFile)).data.preview;
    renderPreview();
  } catch (error) {
    element<HTMLElement>('#calc-main').innerHTML =
      '<div class="customers-empty">' + escapeHtml(apiMessage(error)) + '</div>';
  } finally {
    button.textContent = 'Calcular preço';
    updateReadyState();
  }
}

function closeSaveModal(): void {
  element<HTMLElement>('#calc-save-modal').classList.remove('open');
  element<HTMLElement>('#calc-save-error').hidden = true;
}

function openListsModal(): void {
  element<HTMLElement>('#calc-matrices-modal').classList.add('open');
}

function closeListsModal(): void {
  element<HTMLElement>('#calc-matrices-modal').classList.remove('open');
}

function openCustomerModal(): void {
  element<HTMLElement>('#calc-customer-modal').classList.add('open');
  window.requestAnimationFrame(() => element<HTMLInputElement>('#calc-customer-search').focus());
}

function closeCustomerModal(): void {
  element<HTMLElement>('#calc-customer-modal').classList.remove('open');
}

function openSaveModal(): void {
  if (!preview) return;
  element<HTMLElement>('#calc-save-error').hidden = true;
  element<HTMLElement>('#calc-save-subtitle').textContent =
    preview.kitCode +
    ' · ' +
    preview.priceList.name +
    ' · versão v' +
    preview.priceListVersion.version +
    ' · ' +
    (selectedCustomer?.legalName ?? 'Cliente não selecionado');
  const existing = preview.existing;
  const recalculate = element<HTMLInputElement>('#calc-recalculate');
  const choice = element<HTMLElement>('#calc-recalculate-choice');
  if (existing) {
    const changedList = existing.priceListVersionId !== preview.priceListVersion.id;
    const changedFile = existing.sourceFileHash !== preview.sourceFileHash;
    const changedPhoto = Boolean(photoFile);
    element<HTMLElement>('#calc-existing-state').innerHTML =
      '<strong>Já calculado: Sim</strong><br>Versão atual: v' +
      existing.version +
      ', salva em ' +
      date(existing.createdAt) +
      ' por ' +
      escapeHtml(existing.createdBy) +
      '.<br>' +
      (changedList ? 'A versão ativa da lista mudou. ' : '') +
      (changedPhoto ? 'Uma nova foto foi selecionada e exige uma nova versão. ' : '') +
      (changedFile
        ? 'A folha Korp selecionada é diferente.'
        : 'A folha Korp possui o mesmo conteúdo.');
    choice.hidden = false;
    recalculate.checked = changedList || changedFile || changedPhoto;
    recalculate.disabled = changedPhoto;
  } else {
    element<HTMLElement>('#calc-existing-state').innerHTML =
      '<strong>Já calculado: Não</strong><br>Esta será a primeira versão deste kit para a lista selecionada.';
    choice.hidden = true;
    recalculate.checked = false;
    recalculate.disabled = false;
  }
  element<HTMLElement>('#calc-save-modal').classList.add('open');
}

function renderCustomerOptions(total: number): void {
  const container = element<HTMLElement>('#calc-customer-options');
  container.replaceChildren();
  if (!customers.length) {
    container.innerHTML = '<div class="cliente-empty">Nenhum cliente ativo encontrado.</div>';
    return;
  }
  for (const customer of customers) {
    const button = document.createElement('button');
    button.type = 'button';
    const isSelected = selectedCustomer?.id === customer.id;
    button.className = `calc-customer-option${isSelected ? ' is-selected' : ''}`;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(isSelected));
    button.dataset.customerId = customer.id;
    const segment = customer.customerSegment?.name ?? customer.segment ?? 'Sem segmento';
    const owner = customer.representative ?? customer.seller ?? '—';
    button.innerHTML =
      '<div class="calc-customer-code">' +
      escapeHtml(customer.code) +
      '</div><div class="calc-customer-name"><strong>' +
      escapeHtml(customer.legalName) +
      '</strong><small>' +
      escapeHtml(segment) +
      '</small></div><div class="calc-customer-class">' +
      escapeHtml(customer.customerClass?.name ?? 'Sem classe') +
      '</div><div class="calc-customer-owner">' +
      escapeHtml(owner) +
      '</div><div class="calc-customer-state" aria-hidden="true">' +
      (isSelected ? '✓' : '›') +
      '</div>';
    button.addEventListener('click', () => selectCustomer(customer));
    container.append(button);
  }
  if (total > customers.length) {
    const state = document.createElement('div');
    state.className = 'cliente-empty';
    state.textContent =
      'Mostrando ' +
      customers.length +
      ' de ' +
      total.toLocaleString('pt-BR') +
      '. Digite para refinar.';
    container.append(state);
  }
}

function customerIsCompatible(customer: Customer): boolean {
  return Boolean(
    preview &&
    customer.customerClass &&
    preview.priceList.customerClasses.some(({ id }) => id === customer.customerClass!.id),
  );
}

function selectCustomer(customer: Customer): void {
  selectedCustomer = customer;
  preview = null;
  const compatibleLists = componentLists().filter(
    (list) =>
      customer.customerClass &&
      list.customerClasses.some(({ id }) => id === customer.customerClass!.id),
  );
  selectedPriceListId = compatibleLists.length === 1 ? compatibleLists[0]!.id : null;
  element<HTMLInputElement>('#calc-customer-id').value = customer.id;
  const selected = element<HTMLElement>('#calc-selected-customer');
  selected.textContent = customer.legalName;
  selected.classList.remove('placeholder');
  element<HTMLElement>('#calc-selected-customer-meta').textContent =
    customer.code + ' · ' + (customer.customerClass?.name ?? 'Sem classe');
  element<HTMLElement>('#calc-customer-options')
    .querySelectorAll<HTMLElement>('[data-customer-id]')
    .forEach((option) => {
      const active = option.dataset.customerId === customer.id;
      option.classList.toggle('is-selected', active);
      option.setAttribute('aria-selected', String(active));
      const state = option.querySelector<HTMLElement>('.calc-customer-state');
      if (state) state.textContent = active ? '✓' : '›';
    });
  const error = element<HTMLElement>('#calc-save-error');
  if (!customer.customerClass || compatibleLists.length !== 1) {
    error.textContent = customer.customerClass
      ? compatibleLists.length > 1
        ? `A classe ${customer.customerClass.name} possui mais de uma lista ativa. Ajuste o cadastro para manter uma única lista de componentes.`
        : `A classe ${customer.customerClass.name} não possui lista de componentes ativa.`
      : 'Este cliente não possui classe. Classifique-o antes de salvar o cálculo.';
    error.hidden = false;
  } else {
    error.hidden = true;
  }
  renderPriceListOptions();
  updateReadyState();
  closeCustomerModal();
}

async function loadCustomerOptions(): Promise<void> {
  const container = element<HTMLElement>('#calc-customer-options');
  container.innerHTML = '<div class="cliente-empty">Carregando clientes…</div>';
  try {
    const response = await listCustomers({
      search: element<HTMLInputElement>('#calc-customer-search').value.trim(),
      status: 'active',
      page: 1,
      pageSize: 25,
    });
    customers = response.data.customers;
    renderCustomerOptions(response.data.pagination.total);
  } catch (error) {
    container.innerHTML = '<div class="cliente-empty">' + escapeHtml(apiMessage(error)) + '</div>';
  }
}

async function confirmSave(): Promise<void> {
  if (!preview || !processFile) return;
  const error = element<HTMLElement>('#calc-save-error');
  if (!selectedCustomer) {
    error.textContent = 'Selecione um cliente ativo para salvar.';
    error.hidden = false;
    return;
  }
  if (!customerIsCompatible(selectedCustomer)) {
    error.textContent = 'O cliente não possui uma classe compatível com a lista da prévia.';
    error.hidden = false;
    return;
  }
  const button = element<HTMLButtonElement>('#calc-save-confirm');
  button.disabled = true;
  button.textContent = 'Salvando…';
  try {
    const response = await saveCalculation(preview.priceList.id, processFile, {
      recalculate: element<HTMLInputElement>('#calc-recalculate').checked,
      customerId: selectedCustomer.id,
      expectedPriceListVersionId: preview.priceListVersion.id,
      expectedKitImageId: preview.currentKitImage?.id ?? null,
      image: photoFile,
    });
    const saved = response.data.calculation;
    preview.existing = saved;
    preview.currentKitImage = saved.image;
    preview.image = saved.image;
    clearSelectedPhoto();
    closeSaveModal();
    renderPreview();
    const banner = element<HTMLElement>('#calc-main .calc-preview-banner');
    banner.classList.add('calc-result-saved');
    banner.querySelector('span')!.innerHTML =
      '<strong>Cálculo salvo.</strong> Versão v' +
      saved.version +
      ' vinculada a ' +
      escapeHtml(saved.customerName) +
      ' (' +
      escapeHtml(saved.customerClass?.name) +
      ').';
    element<HTMLButtonElement>('#calc-open-save').textContent = 'Salvar novamente';
  } catch (caught) {
    error.textContent = apiMessage(caught);
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Confirmar salvamento';
  }
}

async function exportPreview(button: HTMLButtonElement): Promise<void> {
  if (!preview) return;
  const currentPreview = preview;
  const exportData: CalculationExportData = {
    kitCode: currentPreview.kitCode,
    kitDescription: currentPreview.kitDescription,
    priceListName: currentPreview.priceList.name,
    priceListVersion: currentPreview.priceListVersion.version,
    minimumTotal: currentPreview.minimumTotal,
    normalTotal: currentPreview.normalTotal,
    itemCount: currentPreview.itemCount,
    missingPriceCount: currentPreview.missingPriceCount,
    items: currentPreview.items
      .filter((item) => !hideMissingPrices || item.hasPrice)
      .map((item) => ({
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minimumUnitPrice: item.minimumUnitPrice,
        minimumTotal: item.minimumTotal,
        normalUnitPrice: item.normalUnitPrice,
        normalTotal: item.normalTotal,
        hasPrice: item.hasPrice,
      })),
  };
  const imageSource: ExportImageSource | null = photoFile
    ? { source: photoFile }
    : currentPreview.image
      ? {
          source: currentPreview.image.displayUrl,
          width: currentPreview.image.width,
          height: currentPreview.image.height,
        }
      : null;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Gerando…';
  try {
    await downloadCalculationWorkbook(
      exportData,
      imageSource,
      'Preco_' +
        currentPreview.kitCode +
        '_' +
        currentPreview.priceList.name.replace(/[\s/]/g, '-') +
        '.xlsx',
    );
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Não foi possível gerar o Excel.');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

export function initializeCalculationsPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLInputElement>('#calc-photo-input').addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files?.[0] ?? null;
    if (!selected) return;
    releasePhotoUrl();
    photoFile = selected;
    photoObjectUrl = URL.createObjectURL(selected);
    renderPhotoSelection();
    if (preview) renderPreview();
  });
  element<HTMLButtonElement>('#calc-photo-remove').addEventListener('click', () => {
    clearSelectedPhoto();
    if (preview) renderPreview();
  });
  element<HTMLInputElement>('#calc-korp-input').addEventListener('change', (event) => {
    const input = event.currentTarget as HTMLInputElement;
    processFile = input.files?.[0] ?? null;
    preview = null;
    element<HTMLElement>('#calc-korp-zone').classList.toggle('ok', Boolean(processFile));
    element<HTMLElement>('#calc-korp-file').textContent = processFile
      ? '✓ ' + processFile.name
      : '';
    updateReadyState();
  });
  element<HTMLButtonElement>('#calc-run').addEventListener('click', () => void runCalculation());
  element<HTMLButtonElement>('#calc-customer-trigger').addEventListener('click', openCustomerModal);
  element<HTMLButtonElement>('#calc-customer-close').addEventListener('click', closeCustomerModal);
  element<HTMLButtonElement>('#calc-customer-cancel').addEventListener('click', closeCustomerModal);
  element<HTMLElement>('#calc-customer-modal').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeCustomerModal();
  });
  element<HTMLButtonElement>('#calc-matrices-open').addEventListener('click', openListsModal);
  element<HTMLButtonElement>('#calc-matrices-close').addEventListener('click', closeListsModal);
  element<HTMLButtonElement>('#calc-matrices-done').addEventListener('click', closeListsModal);
  element<HTMLButtonElement>('#calc-save-close').addEventListener('click', closeSaveModal);
  element<HTMLButtonElement>('#calc-save-cancel').addEventListener('click', closeSaveModal);
  element<HTMLButtonElement>('#calc-save-confirm').addEventListener(
    'click',
    () => void confirmSave(),
  );
  element<HTMLInputElement>('#calc-customer-search').addEventListener('input', () => {
    window.clearTimeout(customerTimer);
    customerTimer = window.setTimeout(() => void loadCustomerOptions(), 250);
  });
}

export function showCalculationsPage(user: AuthenticatedUser): void {
  currentUser = user;
  selectedPriceListId = null;
  selectedCustomer = null;
  customers = [];
  preview = null;
  processFile = null;
  clearSelectedPhoto();
  element<HTMLInputElement>('#calc-korp-input').value = '';
  element<HTMLElement>('#calc-korp-zone').classList.remove('ok');
  element<HTMLElement>('#calc-korp-file').textContent = '';
  element<HTMLInputElement>('#calc-customer-id').value = '';
  element<HTMLInputElement>('#calc-customer-search').value = '';
  const selected = element<HTMLElement>('#calc-selected-customer');
  selected.textContent = 'Escolha um cliente';
  selected.classList.add('placeholder');
  element<HTMLElement>('#calc-selected-customer-meta').textContent =
    'Busque por código ou razão social';
  closeCustomerModal();
  closeListsModal();
  void loadPriceLists();
  void loadCustomerOptions();
}
