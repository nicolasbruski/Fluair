import { ROLE_CODES, type AuthenticatedUser } from '../shared/auth.js';
import type {
  AdminOrderPriceApprovalDetail,
  AdminOrderPriceApprovalSummary,
  MyOrderPriceApprovalSummary,
  OrderPriceApprovalStatusCode,
} from '../shared/order-price-approvals.js';
import { ApiError } from './services/api.js';
import {
  approveAdminOrderPriceApproval,
  cancelMyOrderPriceApproval,
  countAdminOrderPriceApprovals,
  getAdminOrderPriceApproval,
  getMyOrderPriceApproval,
  listAdminOrderPriceApprovals,
  listMyOrderPriceApprovals,
  rejectAdminOrderPriceApproval,
  type AdminOrderPriceApprovalsQuery,
} from './services/order-price-approvals-api.js';

const PAGE_SIZE = 20;
const NOTIFICATION_PAGE_SIZE = 8;
const PERSONAL_NOTIFICATION_PAGE_SIZE = 3;
const PERSONAL_NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const POLL_INTERVAL_MS = 30_000;
const statusLabels: Record<OrderPriceApprovalStatusCode, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Reprovada',
  CANCELLED: 'Cancelada',
  SUPERSEDED: 'Substituída',
  EXPIRED: 'Expirada',
  CONSUMED: 'Consumida',
};

let currentUser: AuthenticatedUser | null = null;
let currentPage = 1;
let totalPages = 1;
let selected: AdminOrderPriceApprovalDetail | null = null;
let decision: 'APPROVE' | 'REJECT' | null = null;
let initialized = false;
let listRequest = 0;
let notificationListRequest = 0;
let pollTimer: number | null = null;
let badgeEnabled = false;
let notificationPanelOpen = false;
const modalReturnFocus = new Map<string, HTMLElement>();

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove();
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function apiMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}

function money(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : value;
}

function quantity(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    : value;
}

function dateTime(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR');
}

function waitTime(seconds: number): string {
  const minutes = Math.max(0, Math.floor(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

function statusTag(status: OrderPriceApprovalStatusCode): HTMLSpanElement {
  const tag = node('span', `approval-status approval-status--${status.toLowerCase()}`);
  tag.textContent = statusLabels[status];
  return tag;
}

function isAdministrator(): boolean {
  return currentUser?.roleCode === ROLE_CODES.administrator;
}

function personalNotificationStart(): string {
  return new Date(Date.now() - PERSONAL_NOTIFICATION_RETENTION_MS).toISOString();
}

function setFeedback(message: string, error = false): void {
  const feedback = element<HTMLElement>('#admin-approvals-feedback');
  feedback.textContent = message;
  feedback.classList.toggle('is-error', error);
  feedback.hidden = !message;
}

function setModalOpen(id: string, open: boolean, focus?: HTMLElement): void {
  const modal = element<HTMLElement>(`#${id}`);
  if (open) {
    if (document.activeElement instanceof HTMLElement)
      modalReturnFocus.set(id, document.activeElement);
    modal.classList.add('open');
    window.setTimeout(
      () => (focus ?? modal.querySelector<HTMLElement>('button, input, textarea'))?.focus(),
      0,
    );
  } else {
    modal.classList.remove('open');
    modalReturnFocus.get(id)?.focus();
    modalReturnFocus.delete(id);
  }
}

function trapModalFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const modal = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.modal');
  if (!modal) return;
  const focusable = [
    ...modal.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((item) => !item.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function closeDetail(): void {
  selected = null;
  setModalOpen('admin-approval-detail-modal', false);
}

function detailField(label: string, value: string): HTMLDivElement {
  const wrapper = node('div', 'approval-detail-field');
  wrapper.append(node('dt', undefined, label), node('dd', undefined, value));
  return wrapper;
}

function renderDetail(detail: AdminOrderPriceApprovalDetail): void {
  const content = element<HTMLElement>('#admin-approval-detail-content');
  clear(content);

  const header = node('div', 'approval-detail-summary');
  const title = node('div');
  title.append(
    node('span', 'approval-detail-eyebrow', 'Cliente'),
    node('strong', undefined, `${detail.customer.code} · ${detail.customer.legalName}`),
    node(
      'small',
      undefined,
      `Solicitação de ${detail.requester.name} · ${dateTime(detail.requestedAt)} · ${detail.itemCount} ${detail.itemCount === 1 ? 'item' : 'itens'} · ${detail.exceptionCount} abaixo do mínimo`,
    ),
  );
  header.append(title, statusTag(detail.status));

  const justification = node('section', 'approval-detail-section');
  justification.append(
    node('h3', undefined, 'Justificativa'),
    node('p', undefined, detail.justification),
  );

  const itemsSection = node('section', 'approval-detail-section');
  itemsSection.append(node('h3', undefined, 'Itens da solicitação'));
  const items = node('div', 'approval-detail-items');
  for (const item of detail.items) {
    const card = node('article', `approval-item${item.requiresApproval ? ' is-exception' : ''}`);
    const itemHeader = node('div', 'approval-item-header');
    const copy = node('div');
    copy.append(
      node('strong', undefined, `${item.code} · ${item.description}`),
      node(
        'small',
        undefined,
        `${item.kind === 'KIT' ? 'Kit' : 'Produto'} · ${item.priceList.name} v${item.priceList.version}`,
      ),
    );
    itemHeader.append(copy);
    if (item.requiresApproval)
      itemHeader.append(node('span', 'approval-exception-mark', 'Abaixo do mínimo'));
    const range = `${item.priceList.minimumOrderQuantity ?? 'sem mínimo'} a ${item.priceList.maximumOrderQuantity ?? 'sem máximo'}`;
    const context = node('div', 'approval-item-context');
    const appliedTaxes = item.taxes
      ? (['pis', 'cofins', 'icms', 'ipi'] as const)
          .filter((code) => item.taxes![code].selected)
          .map((code) => `${code.toUpperCase()} ${item.taxes![code].rate}%`)
          .join(' · ')
      : '';
    context.append(
      node('span', undefined, `Quantidade: ${quantity(item.quantity)}`),
      node('span', undefined, `Faixa: ${range}`),
      ...(appliedTaxes ? [node('span', undefined, `Impostos: ${appliedTaxes}`)] : []),
    );
    const data = node('dl', 'approval-item-data');
    data.append(
      detailField('Mínimo unitário', money(item.minimumUnitPrice)),
      detailField('Solicitado unitário', money(item.negotiatedUnitPrice)),
      ...(item.finalUnitPrice
        ? [detailField('Final com impostos', money(item.finalUnitPrice))]
        : []),
      detailField('Diferença total', money(item.exceptionTotalAmount)),
    );
    card.append(itemHeader, context, data);
    items.append(card);
  }
  itemsSection.append(items);

  content.append(header, justification, itemsSection);
  if (detail.decision) {
    const history = node('section', 'approval-detail-section approval-decision-history');
    history.append(
      node('h3', undefined, 'Decisão'),
      node(
        'p',
        undefined,
        `${statusLabels[detail.status]} por ${detail.decision.reviewer.name} em ${dateTime(detail.decision.reviewedAt)}.`,
      ),
    );
    if (detail.decision.note) history.append(node('p', undefined, detail.decision.note));
    if (detail.decision.approvedUntil)
      history.append(
        node(
          'p',
          'approval-decision-validity',
          `Válida até ${dateTime(detail.decision.approvedUntil)}.`,
        ),
      );
    content.append(history);
  }

  const administrator = isAdministrator();
  const ownRequest = detail.requester.id === currentUser?.id;
  const pending = detail.status === 'PENDING';
  const selfWarning = element<HTMLElement>('#admin-approval-self-warning');
  selfWarning.hidden = !administrator || !ownRequest || !pending;
  const approve = element<HTMLButtonElement>('#admin-approval-approve');
  const reject = element<HTMLButtonElement>('#admin-approval-reject');
  approve.hidden = !administrator || !pending;
  reject.hidden = !administrator || !pending;
  approve.disabled = ownRequest;
  reject.disabled = ownRequest;
  approve.title = ownRequest ? 'Você não pode decidir a própria solicitação.' : '';
  reject.title = ownRequest ? 'Você não pode decidir a própria solicitação.' : '';
}

async function openDetail(id: string): Promise<void> {
  const content = element<HTMLElement>('#admin-approval-detail-content');
  content.textContent = 'Carregando solicitação…';
  element<HTMLButtonElement>('#admin-approval-approve').hidden = true;
  element<HTMLButtonElement>('#admin-approval-reject').hidden = true;
  setModalOpen(
    'admin-approval-detail-modal',
    true,
    element<HTMLButtonElement>('#admin-approval-detail-close'),
  );
  try {
    selected = isAdministrator()
      ? (await getAdminOrderPriceApproval(id)).data
      : (await getMyOrderPriceApproval(id)).data;
    renderDetail(selected);
  } catch (error) {
    content.textContent = apiMessage(error);
  }
}

function setNotificationPanelOpen(open: boolean, restoreFocus = false): void {
  const button = element<HTMLButtonElement>('#admin-approvals-notification-button');
  const panel = element<HTMLElement>('#admin-approvals-notification-panel');
  notificationPanelOpen = open && badgeEnabled;
  panel.hidden = !notificationPanelOpen;
  button.setAttribute('aria-expanded', String(notificationPanelOpen));
  if (notificationPanelOpen) void loadNotificationList();
  else if (restoreFocus) button.focus();
}

function openNotificationDetail(id: string): void {
  setNotificationPanelOpen(false);
  const button = element<HTMLButtonElement>('#admin-approvals-notification-button');
  button.focus();
  void openDetail(id);
}

function renderAdminNotificationList(rows: AdminOrderPriceApprovalSummary[]): void {
  const list = element<HTMLElement>('#admin-approvals-notification-list');
  clear(list);
  if (!rows.length) {
    list.append(
      node('div', 'approval-notifications-state', 'Nenhuma solicitação aguardando análise.'),
    );
    return;
  }
  for (const approval of rows) {
    const item = node('button', 'approval-notification-item');
    item.type = 'button';
    item.addEventListener('click', () => openNotificationDetail(approval.id));
    const head = node('div', 'approval-notification-item-head');
    head.append(
      node('strong', undefined, approval.customer.legalName),
      node('span', 'approval-notification-wait', waitTime(approval.waitingSeconds)),
    );
    const meta = node(
      'div',
      'approval-notification-meta',
      `${approval.requester.name} · ${approval.exceptionCount} de ${approval.itemCount} itens exigem aprovação`,
    );
    const summary = node('div', 'approval-notification-summary');
    summary.append(
      node('span', 'approval-notification-impact', `Impacto ${money(approval.exceptionAmount)}`),
    );
    item.append(head, meta, summary);
    list.append(item);
  }
}

function renderPersonalNotificationList(rows: MyOrderPriceApprovalSummary[]): void {
  const list = element<HTMLElement>('#admin-approvals-notification-list');
  clear(list);
  if (!rows.length) {
    list.append(
      node('div', 'approval-notifications-state', 'Nenhuma solicitação nos últimos 7 dias.'),
    );
    return;
  }
  for (const approval of rows) {
    const item = node('article', 'approval-notification-item approval-notification-item--personal');
    const detail = node('button', 'approval-notification-detail');
    detail.type = 'button';
    detail.addEventListener('click', () => openNotificationDetail(approval.id));
    const head = node('div', 'approval-notification-item-head');
    head.append(node('strong', undefined, approval.customer.legalName), statusTag(approval.status));
    const decision = approval.decision
      ? ` · ${approval.decision.reviewer.name}: ${approval.decision.note ?? 'sem observação'}`
      : '';
    detail.append(
      head,
      node(
        'div',
        'approval-notification-meta',
        `${dateTime(approval.requestedAt)} · ${approval.itemCount} ${approval.itemCount === 1 ? 'item' : 'itens'}${decision}`,
      ),
    );
    const actions = node('div', 'approval-notification-actions');
    if (approval.status !== 'CONSUMED') {
      const resume = node(
        'button',
        'btn btn-ghost btn-sm',
        approval.status === 'APPROVED' ? 'Retomar e gerar pedido' : 'Retomar carrinho',
      );
      resume.type = 'button';
      resume.addEventListener('click', () => {
        setNotificationPanelOpen(false);
        if (window.location.pathname === '/pedidos/novo') {
          window.dispatchEvent(
            new CustomEvent('fluair:approval-resume', { detail: { id: approval.id } }),
          );
          return;
        }
        window.location.assign(`/pedidos/novo?aprovacao=${encodeURIComponent(approval.id)}`);
      });
      actions.append(resume);
    }
    if (approval.status === 'PENDING') {
      const cancel = node('button', 'btn btn-ghost btn-sm', 'Cancelar');
      cancel.type = 'button';
      cancel.addEventListener('click', async () => {
        cancel.disabled = true;
        try {
          await cancelMyOrderPriceApproval(approval.id, { expectedVersion: approval.version });
          window.dispatchEvent(
            new CustomEvent('fluair:approval-cancelled', { detail: { id: approval.id } }),
          );
          await refreshApprovalNotifications();
        } catch (error) {
          window.alert(apiMessage(error));
          cancel.disabled = false;
        }
      });
      actions.append(cancel);
    }
    if (actions.childElementCount) item.append(detail, actions);
    else item.append(detail);
    list.append(item);
  }
}

async function loadNotificationList(): Promise<void> {
  const request = ++notificationListRequest;
  const list = element<HTMLElement>('#admin-approvals-notification-list');
  list.textContent = '';
  list.append(node('div', 'approval-notifications-state', 'Carregando solicitações…'));
  try {
    if (isAdministrator()) {
      const response = await listAdminOrderPriceApprovals(
        {
          status: 'PENDING',
          page: 1,
          pageSize: NOTIFICATION_PAGE_SIZE,
        },
        { notifyAuthenticationFailure: false },
      );
      if (request !== notificationListRequest || !notificationPanelOpen) return;
      renderAdminNotificationList(response.data);
      return;
    }
    const response = await listMyOrderPriceApprovals(
      {
        requestedFrom: personalNotificationStart(),
        page: 1,
        pageSize: PERSONAL_NOTIFICATION_PAGE_SIZE,
      },
      { notifyAuthenticationFailure: false },
    );
    if (request !== notificationListRequest || !notificationPanelOpen) return;
    renderPersonalNotificationList(response.data);
  } catch (error) {
    if (request !== notificationListRequest || !notificationPanelOpen) return;
    clear(list);
    const state = node('div', 'approval-notifications-state');
    state.append(node('span', undefined, apiMessage(error)));
    const retry = node('button', 'btn btn-ghost btn-sm', 'Tentar novamente');
    retry.type = 'button';
    retry.addEventListener('click', () => void loadNotificationList());
    state.append(retry);
    list.append(state);
  }
}

function renderList(rows: AdminOrderPriceApprovalSummary[]): void {
  const body = element<HTMLTableSectionElement>('#admin-approvals-body');
  clear(body);
  if (!rows.length) {
    const row = node('tr');
    const cell = node(
      'td',
      'approval-list-state',
      'Nenhuma solicitação encontrada para os filtros informados.',
    );
    cell.colSpan = 9;
    row.append(cell);
    body.append(row);
    return;
  }
  for (const approval of rows) {
    const row = node('tr');
    const customer = node('td');
    customer.dataset.label = 'Cliente';
    customer.append(
      node('strong', undefined, approval.customer.legalName),
      node('small', undefined, approval.customer.code),
    );
    const requester = node('td');
    requester.dataset.label = 'Solicitante';
    requester.append(
      node('strong', undefined, approval.requester.name),
      node('small', undefined, approval.requester.email),
    );
    const requestedAt = node('td', undefined, dateTime(approval.requestedAt));
    requestedAt.dataset.label = 'Solicitada em';
    const waiting = node('td', undefined, waitTime(approval.waitingSeconds));
    waiting.dataset.label = 'Espera';
    const exceptions = node('td', undefined, `${approval.exceptionCount} de ${approval.itemCount}`);
    exceptions.dataset.label = 'Exceções';
    const total = node('td', undefined, money(approval.requestedTotalAmount));
    total.dataset.label = 'Total';
    const impact = node('td', undefined, money(approval.exceptionAmount));
    impact.dataset.label = 'Impacto';
    const result = node('td');
    result.dataset.label = 'Resultado';
    result.append(statusTag(approval.status));
    if (approval.decision) {
      result.append(
        node('small', undefined, `Por ${approval.decision.reviewer.name}`),
        node('small', undefined, dateTime(approval.decision.reviewedAt)),
      );
    } else {
      result.append(node('small', undefined, 'Aguardando decisão'));
    }
    const action = node('td');
    action.dataset.label = 'Ação';
    const open = node('button', 'btn btn-ghost btn-xs', 'Analisar');
    open.type = 'button';
    open.addEventListener('click', () => void openDetail(approval.id));
    action.append(open);
    row.append(
      customer,
      requester,
      requestedAt,
      waiting,
      exceptions,
      total,
      impact,
      result,
      action,
    );
    body.append(row);
  }
}

function localDateBoundary(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function loadList(): Promise<void> {
  const request = ++listRequest;
  const body = element<HTMLTableSectionElement>('#admin-approvals-body');
  body.innerHTML =
    '<tr><td class="approval-list-state" colspan="9">Carregando solicitações…</td></tr>';
  setFeedback('');
  try {
    const status = element<HTMLSelectElement>('#admin-approvals-status').value as
      OrderPriceApprovalStatusCode | '';
    const code = element<HTMLInputElement>('#admin-approvals-code').value.trim();
    const requestedFrom = localDateBoundary(
      element<HTMLInputElement>('#admin-approvals-from').value,
      false,
    );
    const requestedTo = localDateBoundary(
      element<HTMLInputElement>('#admin-approvals-to').value,
      true,
    );
    const query: AdminOrderPriceApprovalsQuery = {
      page: currentPage,
      pageSize: PAGE_SIZE,
    };
    if (status) query.status = status;
    if (code) query.code = code;
    if (requestedFrom) query.requestedFrom = requestedFrom;
    if (requestedTo) query.requestedTo = requestedTo;
    const response = await listAdminOrderPriceApprovals(query);
    if (request !== listRequest) return;
    totalPages = Math.max(1, response.pagination.totalPages);
    if (currentPage > totalPages) {
      currentPage = totalPages;
      await loadList();
      return;
    }
    renderList(response.data);
    element<HTMLElement>('#admin-approvals-page-label').textContent =
      `Página ${currentPage} de ${totalPages} · ${response.pagination.total} solicitações`;
    element<HTMLButtonElement>('#admin-approvals-prev').disabled = currentPage <= 1;
    element<HTMLButtonElement>('#admin-approvals-next').disabled = currentPage >= totalPages;
  } catch (error) {
    if (request !== listRequest) return;
    clear(body);
    const row = node('tr');
    const cell = node('td', 'approval-list-state');
    cell.colSpan = 9;
    cell.append(node('span', undefined, apiMessage(error)), document.createElement('br'));
    const retry = node('button', 'btn btn-ghost btn-sm', 'Tentar novamente');
    retry.type = 'button';
    retry.addEventListener('click', () => void loadList());
    cell.append(retry);
    row.append(cell);
    body.append(row);
  }
}

function openDecision(kind: 'APPROVE' | 'REJECT'): void {
  if (
    !isAdministrator() ||
    !selected ||
    selected.status !== 'PENDING' ||
    selected.requester.id === currentUser?.id
  )
    return;
  decision = kind;
  const approving = kind === 'APPROVE';
  element<HTMLElement>('#admin-decision-title').textContent = approving
    ? 'Confirmar aprovação'
    : 'Confirmar reprovação';
  element<HTMLElement>('#admin-decision-copy').textContent = approving
    ? 'A aprovação libera este conteúdo exato para uma nova cotação e um único pedido.'
    : 'A reprovação mantém a geração do pedido bloqueada e informa o motivo ao solicitante.';
  const label = element<HTMLElement>('#admin-decision-note-label');
  label.textContent = approving ? 'Observação (opcional)' : 'Motivo da reprovação';
  const note = element<HTMLTextAreaElement>('#admin-decision-note');
  note.value = '';
  note.required = !approving;
  note.minLength = approving ? 0 : 3;
  element<HTMLElement>('#admin-decision-error').hidden = true;
  const submit = element<HTMLButtonElement>('#admin-decision-submit');
  submit.textContent = approving ? 'Confirmar aprovação' : 'Confirmar reprovação';
  submit.className = approving ? 'btn btn-primary' : 'btn btn-danger';
  setModalOpen('admin-approval-decision-modal', true, note);
}

async function reloadSelected(): Promise<void> {
  if (!selected) return;
  try {
    selected = (await getAdminOrderPriceApproval(selected.id)).data;
    renderDetail(selected);
  } catch {
    closeDetail();
  }
}

async function submitDecision(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!isAdministrator() || !selected || !decision) return;
  const note = element<HTMLTextAreaElement>('#admin-decision-note');
  if (!note.reportValidity()) return;
  const submit = element<HTMLButtonElement>('#admin-decision-submit');
  submit.disabled = true;
  element<HTMLButtonElement>('#admin-decision-cancel').disabled = true;
  const errorBox = element<HTMLElement>('#admin-decision-error');
  errorBox.hidden = true;
  try {
    const response =
      decision === 'APPROVE'
        ? await approveAdminOrderPriceApproval(selected.id, selected.version, note.value)
        : await rejectAdminOrderPriceApproval(selected.id, selected.version, note.value);
    selected = response.data;
    setModalOpen('admin-approval-decision-modal', false);
    renderDetail(selected);
    setFeedback(
      decision === 'APPROVE'
        ? 'Solicitação aprovada com sucesso.'
        : 'Solicitação reprovada com sucesso.',
    );
    element<HTMLElement>('#admin-approvals-announcement').textContent =
      `Solicitação ${statusLabels[selected.status].toLowerCase()} com sucesso.`;
    await Promise.all([loadList(), refreshApprovalNotifications()]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ORDER_PRICE_APPROVAL_CONCURRENT_DECISION') {
      setModalOpen('admin-approval-decision-modal', false);
      await Promise.all([reloadSelected(), loadList(), refreshApprovalNotifications()]);
      const message =
        'Esta solicitação foi atualizada por outro administrador. O estado mais recente foi carregado.';
      setFeedback(message, true);
      element<HTMLElement>('#admin-approvals-announcement').textContent = message;
    } else {
      errorBox.textContent = apiMessage(error);
      errorBox.hidden = false;
    }
  } finally {
    submit.disabled = false;
    element<HTMLButtonElement>('#admin-decision-cancel').disabled = false;
  }
}

function renderBadge(count: number): void {
  const badge = element<HTMLElement>('#admin-approvals-badge');
  const normalized = Math.max(0, Math.floor(count));
  badge.hidden = normalized === 0 || !badgeEnabled;
  const button = element<HTMLButtonElement>('#admin-approvals-notification-button');
  button.setAttribute(
    'aria-label',
    normalized
      ? `Solicitações de aprovação, ${normalized} pendência${normalized === 1 ? '' : 's'}`
      : 'Solicitações de aprovação, sem pendências',
  );
}

export async function refreshApprovalNotifications(): Promise<void> {
  if (!badgeEnabled) return;
  try {
    const pending = isAdministrator()
      ? (await countAdminOrderPriceApprovals({ notifyAuthenticationFailure: false })).data.pending
      : (
          await listMyOrderPriceApprovals(
            {
              status: 'PENDING',
              requestedFrom: personalNotificationStart(),
              page: 1,
              pageSize: 1,
            },
            { notifyAuthenticationFailure: false },
          )
        ).pagination.total;
    renderBadge(pending);
    if (notificationPanelOpen) await loadNotificationList();
  } catch {
    // O contador é complementar: uma falha não deve interromper navegação ou sessão.
  }
}

function stopBadge(): void {
  badgeEnabled = false;
  notificationListRequest += 1;
  setNotificationPanelOpen(false);
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  renderBadge(0);
  element<HTMLElement>('#admin-approval-notifications').hidden = true;
}

function onVisibilityChange(): void {
  if (badgeEnabled && document.visibilityState === 'visible') void refreshApprovalNotifications();
}

function onWindowFocus(): void {
  if (badgeEnabled) void refreshApprovalNotifications();
}

export function configureAdminApprovalNotifications(user: AuthenticatedUser | null): void {
  currentUser = user;
  stopBadge();
  if (!user) return;
  badgeEnabled = true;
  element<HTMLElement>('#admin-approval-notifications').hidden = false;
  element<HTMLElement>('#admin-approvals-notification-title').textContent = isAdministrator()
    ? 'Solicitações de aprovação'
    : 'Minhas solicitações';
  element<HTMLElement>('#admin-approvals-notification-subtitle').textContent = isAdministrator()
    ? 'Preços aguardando análise'
    : 'Até 3 solicitações dos últimos 7 dias';
  element<HTMLAnchorElement>('#admin-approvals-nav-link').hidden = !isAdministrator();
  void refreshApprovalNotifications();
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshApprovalNotifications();
  }, POLL_INTERVAL_MS);
}

export function initializeAdminPriceApprovalsPage(): void {
  if (initialized) return;
  initialized = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onWindowFocus);
  window.addEventListener('fluair:approval-notifications-refresh', () => {
    void refreshApprovalNotifications();
  });
  const notificationButton = element<HTMLButtonElement>('#admin-approvals-notification-button');
  notificationButton.addEventListener('click', () => {
    setNotificationPanelOpen(!notificationPanelOpen);
  });
  element<HTMLButtonElement>('#admin-approvals-notification-close').addEventListener('click', () =>
    setNotificationPanelOpen(false, true),
  );
  element<HTMLAnchorElement>('#admin-approvals-nav-link').addEventListener('click', () =>
    setNotificationPanelOpen(false),
  );
  document.addEventListener('click', (event) => {
    if (
      notificationPanelOpen &&
      !element<HTMLElement>('#admin-approval-notifications').contains(event.target as Node)
    )
      setNotificationPanelOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && notificationPanelOpen) {
      event.preventDefault();
      setNotificationPanelOpen(false, true);
    }
  });
  element<HTMLFormElement>('#admin-approvals-filters').addEventListener('submit', (event) => {
    event.preventDefault();
    currentPage = 1;
    void loadList();
  });
  element<HTMLButtonElement>('#admin-approvals-clear').addEventListener('click', () => {
    element<HTMLFormElement>('#admin-approvals-filters').reset();
    currentPage = 1;
    void loadList();
  });
  element<HTMLButtonElement>('#admin-approvals-prev').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      void loadList();
    }
  });
  element<HTMLButtonElement>('#admin-approvals-next').addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage += 1;
      void loadList();
    }
  });
  for (const id of ['admin-approval-detail-close', 'admin-approval-detail-done']) {
    element<HTMLButtonElement>(`#${id}`).addEventListener('click', closeDetail);
  }
  element<HTMLButtonElement>('#admin-approval-approve').addEventListener('click', () =>
    openDecision('APPROVE'),
  );
  element<HTMLButtonElement>('#admin-approval-reject').addEventListener('click', () =>
    openDecision('REJECT'),
  );
  element<HTMLFormElement>('#admin-decision-form').addEventListener(
    'submit',
    (event) => void submitDecision(event),
  );
  for (const id of ['admin-decision-close', 'admin-decision-cancel']) {
    element<HTMLButtonElement>(`#${id}`).addEventListener('click', () =>
      setModalOpen('admin-approval-decision-modal', false),
    );
  }
  for (const id of ['admin-approval-detail-modal', 'admin-approval-decision-modal']) {
    const modal = element<HTMLElement>(`#${id}`);
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (id === 'admin-approval-detail-modal') closeDetail();
        else setModalOpen(id, false);
      } else trapModalFocus(event);
    });
  }
}

export function showAdminPriceApprovalsPage(user: AuthenticatedUser): void {
  currentUser = user;
  currentPage = 1;
  void loadList();
}
