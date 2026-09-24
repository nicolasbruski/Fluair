import { ROLE_CODES, type AuthenticatedUser } from '../shared/auth.js';
import type { ManagedRole, ManagedUser } from '../shared/users.js';
import { ApiError } from './services/api.js';
import {
  createUser,
  listUsers,
  setUserActive,
  updateUser,
  type UpdateUserInput,
} from './services/users-api.js';

let currentUser: AuthenticatedUser | null = null;
let users: ManagedUser[] = [];
let roles: ManagedRole[] = [];
let editingUserId: string | null = null;
let statusTarget: { id: string; active: boolean } | null = null;
let initialized = false;

const CREATE_ROLE_LABELS = new Map<string, string>([
  [ROLE_CODES.administrator, 'Admin'],
  [ROLE_CODES.calculationOperator, 'Vendedor'],
]);

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function canManage(): boolean {
  return Boolean(currentUser?.permissions.includes('user.manage'));
}

function clear(node: Element): void {
  while (node.firstChild) node.firstChild.remove();
}

function setError(selector: string, message: string): void {
  const target = element<HTMLElement>(selector);
  target.textContent = message;
  target.hidden = !message;
}

function apiMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir a operação. Tente novamente.';
}

function setFeedback(message: string): void {
  const feedback = element<HTMLElement>('#users-feedback');
  feedback.textContent = message;
  feedback.hidden = !message;
}

function setPasswordVisibility(inputId: string, visible: boolean): void {
  const input = element<HTMLInputElement>(`#${inputId}`);
  const toggle = element<HTMLButtonElement>(`#${inputId}-toggle`);
  input.type = visible ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(visible));
  const description = inputId === 'novo-senha' ? 'senha inicial' : 'nova senha';
  toggle.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Exibir'} ${description}`);
}

function togglePasswordVisibility(inputId: string): void {
  const toggle = element<HTMLButtonElement>(`#${inputId}-toggle`);
  setPasswordVisibility(inputId, toggle.getAttribute('aria-pressed') !== 'true');
}

function avatarColor(user: ManagedUser): string {
  const colors = ['#5856d6', '#ff2d55', '#af52de', '#32ade6', '#ff9f0a', '#1c7ed6'];
  const seed = [...user.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[seed % colors.length] ?? '#007aff';
}

function permissionSummary(user: ManagedUser): string {
  const count = user.permissions.length;
  return `${count} permiss${count === 1 ? 'ão' : 'ões'} efetiva${count === 1 ? '' : 's'}`;
}

function button(label: string, className: string, action: () => void): HTMLButtonElement {
  const result = document.createElement('button');
  result.type = 'button';
  result.className = className;
  result.textContent = label;
  result.addEventListener('click', action);
  return result;
}

function renderUsers(): void {
  const list = element<HTMLElement>('#lista-usuarios');
  clear(list);
  if (users.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'users-state';
    empty.textContent = 'Nenhum usuário cadastrado.';
    list.append(empty);
    return;
  }

  for (const user of users) {
    const row = document.createElement('div');
    row.className = `user-row${user.active ? '' : ' inactive'}`;
    row.dataset.userId = user.id;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = avatarColor(user);
    avatar.textContent = user.name.charAt(0).toUpperCase();

    const copy = document.createElement('div');
    copy.className = 'users-user-copy';
    const name = document.createElement('div');
    name.className = 'user-name';
    name.textContent = user.name;
    const email = document.createElement('div');
    email.className = 'user-email';
    email.textContent = user.email;
    const meta = document.createElement('div');
    meta.className = 'users-user-meta';
    const state = document.createElement('span');
    state.className = `tag ${user.active ? 'tag-green' : 'tag-red'}`;
    state.textContent = user.active ? 'Ativo' : 'Desativado';
    const permissions = document.createElement('span');
    permissions.className = 'users-permissions';
    permissions.textContent = permissionSummary(user);
    meta.append(state, permissions);
    copy.append(name, email, meta);

    const role = document.createElement('span');
    role.className = `tag ${user.role.code === 'ADMINISTRATOR' ? 'tag-blue' : 'tag-gray'}`;
    role.textContent = user.role.name;
    row.append(avatar, copy, role);

    if (canManage()) {
      const actions = document.createElement('div');
      actions.className = 'user-actions';
      actions.append(
        button('Editar', 'btn btn-ghost btn-xs', () => openEdit(user.id)),
        button(
          user.active ? 'Desativar' : 'Ativar',
          user.active ? 'btn btn-danger btn-xs' : 'btn btn-ghost btn-xs',
          () => openStatus(user.id),
        ),
      );
      const statusButton = actions.lastElementChild as HTMLButtonElement | null;
      if (user.active && user.id === currentUser?.id && statusButton) {
        statusButton.disabled = true;
        statusButton.title = 'Você não pode desativar a própria conta.';
      }
      row.append(actions);
    }
    list.append(row);
  }
}

function populateRoleSelect(
  select: HTMLSelectElement,
  selected?: string,
  availableRoles: ManagedRole[] = roles,
  labels?: ReadonlyMap<string, string>,
): void {
  clear(select);
  for (const role of availableRoles) {
    const option = document.createElement('option');
    option.value = role.code;
    option.textContent = labels?.get(role.code) ?? role.name;
    option.selected = role.code === selected;
    select.append(option);
  }
}

function renderRoles(): void {
  const body = element<HTMLTableSectionElement>('#users-roles-body');
  clear(body);
  for (const role of roles) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.textContent = role.name;
    const permissions = document.createElement('td');
    permissions.className = 'users-permissions';
    permissions.textContent = role.permissions.join(', ') || 'Sem permissões';
    row.append(name, permissions);
    body.append(row);
  }
  populateRoleSelect(
    element<HTMLSelectElement>('#novo-perfil'),
    undefined,
    roles.filter((role) => CREATE_ROLE_LABELS.has(role.code)),
    CREATE_ROLE_LABELS,
  );
}

async function load(): Promise<void> {
  const list = element<HTMLElement>('#lista-usuarios');
  list.innerHTML = '<div class="users-state">Carregando usuários…</div>';
  try {
    const response = await listUsers();
    users = response.data.users;
    roles = response.data.roles;
    renderUsers();
    renderRoles();
  } catch (error) {
    clear(list);
    const state = document.createElement('div');
    state.className = 'users-state';
    state.textContent = apiMessage(error);
    const retry = button('Tentar novamente', 'btn btn-ghost btn-sm', () => void load());
    retry.style.marginTop = '12px';
    state.append(document.createElement('br'), retry);
    list.append(state);
  }
}

function closeModal(id: string): void {
  element<HTMLElement>(`#${id}`).classList.remove('open');
}

function closeEditModal(): void {
  element<HTMLInputElement>('#edit-senha').value = '';
  setPasswordVisibility('edit-senha', false);
  closeModal('modal-editar-usuario');
}

function openEdit(id: string): void {
  const user = users.find((item) => item.id === id);
  if (!user) return;
  editingUserId = id;
  element<HTMLInputElement>('#edit-nome').value = user.name;
  element<HTMLInputElement>('#edit-email').value = user.email;
  element<HTMLInputElement>('#edit-senha').value = '';
  setPasswordVisibility('edit-senha', false);
  element<HTMLInputElement>('#edit-comissoes').checked =
    user.permissions.includes('commission.access');
  populateRoleSelect(element<HTMLSelectElement>('#edit-perfil'), user.role.code);
  setError('#edit-user-error', '');
  element<HTMLElement>('#modal-editar-usuario').classList.add('open');
  element<HTMLInputElement>('#edit-nome').focus();
}

function openStatus(id: string): void {
  const user = users.find((item) => item.id === id);
  if (!user) return;
  statusTarget = { id, active: !user.active };
  const activating = !user.active;
  element<HTMLElement>('#status-user-title').textContent = activating
    ? 'Ativar usuário'
    : 'Desativar usuário';
  element<HTMLElement>('#status-user-message').textContent = activating
    ? `${user.name} poderá entrar novamente no sistema.`
    : `${user.name} perderá o acesso e todas as sessões abertas serão encerradas.`;
  const confirm = element<HTMLButtonElement>('#status-user-confirm');
  confirm.textContent = activating ? 'Ativar usuário' : 'Desativar usuário';
  confirm.className = activating ? 'btn btn-primary' : 'btn btn-danger';
  setError('#status-user-error', '');
  element<HTMLElement>('#modal-status-usuario').classList.add('open');
}

async function submitCreate(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const submit = element<HTMLButtonElement>('#users-create-submit');
  const password = element<HTMLInputElement>('#novo-senha');
  submit.disabled = true;
  setError('#novo-erro', '');
  try {
    await createUser({
      name: element<HTMLInputElement>('#novo-nome').value,
      email: element<HTMLInputElement>('#novo-email').value,
      password: password.value,
      roleCode: element<HTMLSelectElement>('#novo-perfil').value,
      commissionAccess: element<HTMLInputElement>('#novo-comissoes').checked,
    });
    form.reset();
    setPasswordVisibility('novo-senha', false);
    setFeedback('Usuário criado com sucesso.');
    await load();
  } catch (error) {
    setError('#novo-erro', apiMessage(error));
  } finally {
    password.value = '';
    setPasswordVisibility('novo-senha', false);
    submit.disabled = false;
  }
}

async function submitEdit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!editingUserId) return;
  const form = event.currentTarget as HTMLFormElement;
  if (!form.reportValidity()) return;
  const submit = element<HTMLButtonElement>('#edit-user-submit');
  const password = element<HTMLInputElement>('#edit-senha');
  submit.disabled = true;
  setError('#edit-user-error', '');
  const input: UpdateUserInput = {
    name: element<HTMLInputElement>('#edit-nome').value,
    email: element<HTMLInputElement>('#edit-email').value,
    roleCode: element<HTMLSelectElement>('#edit-perfil').value,
    commissionAccess: element<HTMLInputElement>('#edit-comissoes').checked,
    ...(password.value ? { password: password.value } : {}),
  };
  try {
    const response = await updateUser(editingUserId, input);
    if (editingUserId === currentUser?.id) {
      currentUser = { ...currentUser, permissions: response.data.user.permissions };
      window.dispatchEvent(
        new CustomEvent('fluair:permissions-changed', {
          detail: response.data.user.permissions,
        }),
      );
    }
    closeEditModal();
    setFeedback('Usuário atualizado com sucesso.');
    await load();
  } catch (error) {
    setError('#edit-user-error', apiMessage(error));
  } finally {
    password.value = '';
    setPasswordVisibility('edit-senha', false);
    submit.disabled = false;
  }
}

async function confirmStatus(): Promise<void> {
  if (!statusTarget) return;
  const confirm = element<HTMLButtonElement>('#status-user-confirm');
  confirm.disabled = true;
  setError('#status-user-error', '');
  try {
    const action = statusTarget.active ? 'ativado' : 'desativado';
    await setUserActive(statusTarget.id, statusTarget.active);
    closeModal('modal-status-usuario');
    setFeedback(`Usuário ${action} com sucesso.`);
    await load();
  } catch (error) {
    setError('#status-user-error', apiMessage(error));
  } finally {
    confirm.disabled = false;
  }
}

export function initializeUsersPage(): void {
  if (initialized) return;
  initialized = true;
  element<HTMLFormElement>('#users-create-form').addEventListener('submit', (event) => {
    void submitCreate(event);
  });
  element<HTMLFormElement>('#users-edit-form').addEventListener('submit', (event) => {
    void submitEdit(event);
  });
  element<HTMLButtonElement>('#status-user-confirm').addEventListener('click', () => {
    void confirmStatus();
  });
  for (const inputId of ['novo-senha', 'edit-senha']) {
    element<HTMLButtonElement>(`#${inputId}-toggle`).addEventListener('click', () =>
      togglePasswordVisibility(inputId),
    );
  }
  for (const id of ['edit-user-close', 'edit-user-cancel']) {
    element<HTMLButtonElement>(`#${id}`).addEventListener('click', closeEditModal);
  }
  for (const id of ['status-user-close', 'status-user-cancel']) {
    element<HTMLButtonElement>(`#${id}`).addEventListener('click', () =>
      closeModal('modal-status-usuario'),
    );
  }
}

export function showUsersPage(user: AuthenticatedUser): void {
  currentUser = user;
  element<HTMLElement>('#users-create-section').hidden = !canManage();
  setFeedback('');
  void load();
}
