import type { AuthenticatedUser, PermissionCode } from '../shared/auth.js';
import { initializeCalculationsPage, showCalculationsPage } from './calculations-page.js';
import { initializeDetailPage, showDetailPage } from './detail-page.js';
import { currentSession, login, logout } from './services/auth-api.js';
import { ApiError } from './services/api.js';
import { initializeCustomersPage, showCustomersPage } from './customers-page.js';
import { initializeOrdersPage, showOrdersPage } from './orders-page.js';
import { initializeProductsPage, showProductsPage } from './products-page.js';
import { initializePriceListsPage, showPriceListsPage } from './price-lists-page.js';
import { initializeSearchPage, showSearchPage } from './search-page.js';
import { initializeUsersPage, showUsersPage } from './users-page.js';

declare global {
  interface Window {
    show: (id: string) => void;
  }
}

interface RouteDefinition {
  path: string;
  screen: string;
  permissions: PermissionCode[];
  external?: boolean;
}

interface RouteDestination {
  route: RouteDefinition;
  href: string;
}

const routes: RouteDefinition[] = [
  { path: '/calculos', screen: 'busca', permissions: ['calculation.view'] },
  { path: '/calculos/novo', screen: 'calc', permissions: ['calculation.create'] },
  { path: '/pedidos/novo', screen: 'pedido', permissions: ['order.access'] },
  { path: '/produtos', screen: 'produtos', permissions: ['price.view', 'catalog.manage'] },
  { path: '/clientes', screen: 'clientes', permissions: ['customer.view', 'customer.manage'] },
  { path: '/listas', screen: 'matriz', permissions: ['matrix.view', 'matrix.manage'] },
  {
    path: '/comissoes',
    screen: 'comissoes',
    permissions: ['commission.access'],
    external: true,
  },
  { path: '/usuarios', screen: 'usuarios', permissions: ['user.view', 'user.manage'] },
];

const screenPermissions = new Map<string, PermissionCode[]>([
  ['busca', ['calculation.view']],
  ['detalhe', ['calculation.view']],
  ['calc', ['calculation.create']],
  ['historico', ['calculation.history']],
  ['pedido', ['order.access']],
  ['produtos', ['price.view', 'catalog.manage']],
  ['clientes', ['customer.view', 'customer.manage']],
  ['matriz', ['matrix.view', 'matrix.manage']],
  ['usuarios', ['user.view', 'user.manage']],
]);

const legacyShow = window.show.bind(window);
let authenticatedUser: AuthenticatedUser | null = null;
let submitting = false;
const referencePriceVisibilityKey = 'fluair:hide-reference-prices';

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Elemento obrigatório ausente: ${selector}`);
  return found;
}

function hasAnyPermission(user: AuthenticatedUser, permissions: PermissionCode[]): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}

function setReferencePricesHidden(hidden: boolean): void {
  document.body.classList.toggle('reference-prices-hidden', hidden);
  document
    .querySelectorAll<HTMLInputElement>('input[data-reference-price-visibility]')
    .forEach((toggle) => {
      toggle.checked = hidden;
      toggle.setAttribute('aria-checked', String(hidden));
    });
  try {
    window.localStorage.setItem(referencePriceVisibilityKey, String(hidden));
  } catch {
    // A preferência continua válida durante a sessão mesmo sem armazenamento local.
  }
}

function initializeReferencePriceVisibility(): void {
  let hidden = false;
  try {
    hidden = window.localStorage.getItem(referencePriceVisibilityKey) === 'true';
  } catch {
    // Alguns navegadores podem bloquear o armazenamento local.
  }
  setReferencePricesHidden(hidden);
  document
    .querySelectorAll<HTMLInputElement>('input[data-reference-price-visibility]')
    .forEach((toggle) => {
      toggle.addEventListener('change', (event) => {
        setReferencePricesHidden((event.currentTarget as HTMLInputElement).checked);
      });
    });
}

function routeForPath(path: string): RouteDefinition | undefined {
  if (/^\/calculos\/[0-9a-f-]{36}$/i.test(path))
    return { path, screen: 'detalhe', permissions: ['calculation.view'] };
  return routes.find((route) => route.path === path);
}

function firstAllowedRoute(user: AuthenticatedUser): RouteDefinition | undefined {
  return routes.find((route) => hasAnyPermission(user, route.permissions));
}

function safeReturnDestination(user: AuthenticatedUser): RouteDestination | undefined {
  const requested = new URLSearchParams(window.location.search).get('returnTo');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return undefined;
  const url = new URL(requested, window.location.origin);
  const route = routeForPath(url.pathname);
  return route && hasAnyPermission(user, route.permissions)
    ? { route, href: `${url.pathname}${url.search}${url.hash}` }
    : undefined;
}

function updateNavigation(activeScreen: string | null): void {
  const nav = element<HTMLElement>('#app-nav');
  nav.hidden = !authenticatedUser;
  element<HTMLElement>('#session-user-name').textContent = authenticatedUser?.name ?? '';
  nav.querySelectorAll<HTMLAnchorElement>('a[data-screen]').forEach((link) => {
    const permissions = (link.dataset.permissions ?? '').split(',') as PermissionCode[];
    const allowed = Boolean(authenticatedUser && hasAnyPermission(authenticatedUser, permissions));
    link.hidden = !allowed;
    const active = link.dataset.screen === activeScreen;
    link.classList.toggle('on', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function showScreen(screen: string): void {
  legacyShow(screen);
  updateNavigation(screen);
  if (screen === 'pedido' && authenticatedUser) showOrdersPage(authenticatedUser);
  if (screen === 'produtos' && authenticatedUser) showProductsPage(authenticatedUser);
  if (screen === 'busca' && authenticatedUser) showSearchPage();
  if (screen === 'detalhe' && authenticatedUser) {
    const id = window.location.pathname.split('/').at(-1);
    if (id) showDetailPage(authenticatedUser, id);
  }
  if (screen === 'calc' && authenticatedUser) showCalculationsPage(authenticatedUser);
  if (screen === 'clientes' && authenticatedUser) showCustomersPage(authenticatedUser);
  if (screen === 'matriz' && authenticatedUser) showPriceListsPage(authenticatedUser);
  if (screen === 'usuarios' && authenticatedUser) showUsersPage(authenticatedUser);
}

window.show = (screen: string): void => {
  if (screen === 'login' || screen === 'session-loading' || screen === 'forbidden') {
    showScreen(screen);
    return;
  }
  const required = screenPermissions.get(screen);
  if (!authenticatedUser || (required && !hasAnyPermission(authenticatedUser, required))) {
    showScreen('forbidden');
    return;
  }
  showScreen(screen);
};

function enterLogin(message = ''): void {
  authenticatedUser = null;
  const intended = `${window.location.pathname}${window.location.search}`;
  if (window.location.pathname !== '/login') {
    window.history.replaceState(null, '', `/login?returnTo=${encodeURIComponent(intended)}`);
  }
  showScreen('login');
  setPasswordVisibility(false);
  setLoginError(message);
  element<HTMLInputElement>('#login-email').focus();
}

function navigateTo(route: RouteDefinition, replace = false, href = route.path): void {
  if (route.external) {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  const historyMethod = replace ? 'replaceState' : 'pushState';
  window.history[historyMethod](null, '', href);
  window.show(route.screen);
}

function renderPath(): void {
  if (!authenticatedUser) {
    enterLogin();
    return;
  }
  if (window.location.pathname === '/login') {
    const returned = safeReturnDestination(authenticatedUser);
    const destination = returned?.route ?? firstAllowedRoute(authenticatedUser);
    if (destination) navigateTo(destination, true, returned?.href);
    else {
      window.history.replaceState(null, '', '/sem-acesso');
      showScreen('forbidden');
    }
    return;
  }
  const route = routeForPath(window.location.pathname);
  if (!route || !hasAnyPermission(authenticatedUser, route.permissions)) {
    showScreen('forbidden');
    return;
  }
  if (route.external) {
    window.location.replace(route.path);
    return;
  }
  window.show(route.screen);
}

function setLoginError(message: string): void {
  const error = element<HTMLElement>('#login-error');
  error.textContent = message;
  error.hidden = !message;
}

function setPasswordVisibility(visible: boolean): void {
  const passwordInput = element<HTMLInputElement>('#login-password');
  const toggle = element<HTMLButtonElement>('#login-password-toggle');
  passwordInput.type = visible ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(visible));
  toggle.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Exibir senha');
}

function setFieldError(field: 'email' | 'password', message: string): void {
  const input = element<HTMLInputElement>(`#login-${field}`);
  element<HTMLElement>(`#login-${field}-error`).textContent = message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function validateLogin(email: string, password: string): boolean {
  setFieldError('email', '');
  setFieldError('password', '');
  let valid = true;
  if (!email) {
    setFieldError('email', 'Informe o e-mail.');
    valid = false;
  } else if (!element<HTMLInputElement>('#login-email').validity.valid) {
    setFieldError('email', 'Informe um e-mail válido.');
    valid = false;
  }
  if (!password) {
    setFieldError('password', 'Informe a senha.');
    valid = false;
  }
  return valid;
}

function setSubmitting(value: boolean): void {
  submitting = value;
  element<HTMLFormElement>('#login-form').setAttribute('aria-busy', String(value));
  element<HTMLButtonElement>('#login-submit').disabled = value;
  element<HTMLInputElement>('#login-email').readOnly = value;
  element<HTMLInputElement>('#login-password').readOnly = value;
  element<HTMLElement>('#login-submit-label').innerHTML = value
    ? '<span class="spin" aria-hidden="true"></span> Entrando…'
    : 'Entrar';
}

async function submitLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (submitting) return;
  const emailInput = element<HTMLInputElement>('#login-email');
  const passwordInput = element<HTMLInputElement>('#login-password');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  setLoginError('');
  if (!validateLogin(email, password)) return;

  setSubmitting(true);
  try {
    const response = await login(email, password);
    authenticatedUser = response.data.user;
    const returned = safeReturnDestination(authenticatedUser);
    const destination = returned?.route ?? firstAllowedRoute(authenticatedUser);
    if (destination) navigateTo(destination, true, returned?.href);
    else {
      window.history.replaceState(null, '', '/sem-acesso');
      showScreen('forbidden');
    }
  } catch (error) {
    if (error instanceof ApiError) {
      setFieldError('email', error.fieldErrors.email?.[0] ?? '');
      setFieldError('password', error.fieldErrors.password?.[0] ?? '');
      setLoginError(error.message);
    } else {
      setLoginError('O sistema está temporariamente indisponível. Tente novamente.');
    }
  } finally {
    passwordInput.value = '';
    setSubmitting(false);
  }
}

async function performLogout(): Promise<void> {
  const button = element<HTMLButtonElement>('#logout-button');
  button.disabled = true;
  try {
    await logout();
    authenticatedUser = null;
    window.history.replaceState(null, '', '/login');
    enterLogin();
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Não foi possível encerrar a sessão. Tente novamente.';
    window.alert(message);
  } finally {
    button.disabled = false;
  }
}

async function initialize(): Promise<void> {
  initializeReferencePriceVisibility();
  initializeSearchPage();
  initializeDetailPage();
  initializeCalculationsPage();
  initializeCustomersPage();
  initializeOrdersPage();
  initializeProductsPage();
  initializePriceListsPage();
  initializeUsersPage();
  element<HTMLFormElement>('#login-form').addEventListener('submit', (event) => {
    void submitLogin(event);
  });
  element<HTMLButtonElement>('#login-password-toggle').addEventListener('click', () => {
    const passwordInput = element<HTMLInputElement>('#login-password');
    setPasswordVisibility(passwordInput.type === 'password');
  });
  element<HTMLButtonElement>('#logout-button').addEventListener('click', () => {
    void performLogout();
  });
  element<HTMLElement>('#app-nav').addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-screen]');
    if (!link || link.hidden) return;
    event.preventDefault();
    const route = routeForPath(new URL(link.href).pathname);
    if (route) navigateTo(route);
  });
  window.addEventListener('popstate', renderPath);
  window.addEventListener('fluair:session-expired', (event) => {
    const error = (event as CustomEvent<ApiError>).detail;
    const message =
      error.code === 'ACCOUNT_INACTIVE'
        ? 'Sua conta está desativada. Fale com o administrador.'
        : 'Sua sessão expirou. Entre novamente.';
    enterLogin(message);
  });
  window.addEventListener('fluair:permissions-changed', (event) => {
    if (!authenticatedUser) return;
    authenticatedUser = {
      ...authenticatedUser,
      permissions: (event as CustomEvent<PermissionCode[]>).detail,
    };
    updateNavigation(routeForPath(window.location.pathname)?.screen ?? null);
  });

  try {
    const response = await currentSession();
    authenticatedUser = response.data.user;
    renderPath();
  } catch (error) {
    let message = '';
    if (error instanceof ApiError) {
      if (error.code === 'SESSION_EXPIRED' || error.code === 'ACCOUNT_INACTIVE') {
        message = error.message;
      } else if (error.status === 0 || error.status >= 500) {
        message = 'O sistema está temporariamente indisponível. Tente novamente.';
      }
    } else {
      message = 'O sistema está temporariamente indisponível. Tente novamente.';
    }
    enterLogin(message);
  }
}

void initialize();
