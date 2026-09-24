import { expect, test } from '@playwright/test';

const sessionUser = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Administradora do Banco',
  email: 'admin@fluair.test',
  permissions: ['user.view', 'user.manage'],
};

const roles = [
  {
    code: 'ADMINISTRATOR',
    name: 'Administrador',
    description: 'Acesso total.',
    permissions: ['user.view', 'user.manage', 'calculation.view'],
  },
  {
    code: 'CALCULATION_OPERATOR',
    name: 'Operador de cálculo',
    description: 'Calcula e consulta.',
    permissions: ['calculation.view', 'calculation.create'],
  },
  {
    code: 'READ_ONLY',
    name: 'Consulta',
    description: 'Somente consulta.',
    permissions: ['calculation.view'],
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
});

test('lista e administra os usuários retornados pela API', async ({ page }) => {
  let users = [
    {
      id: sessionUser.id,
      name: sessionUser.name,
      email: sessionUser.email,
      active: true,
      role: { code: 'ADMINISTRATOR', name: 'Administrador' },
      permissions: sessionUser.permissions,
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    },
  ];

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: sessionUser,
          session: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
        },
      }),
    }),
  );
  await page.route('**/api/v1/users**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname === '/api/v1/users' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { users, roles } }),
      });
      return;
    }
    if (pathname === '/api/v1/users' && request.method() === 'POST') {
      const input = request.postDataJSON() as {
        name: string;
        email: string;
        roleCode: string;
        commissionAccess: boolean;
      };
      const role = roles.find((item) => item.code === input.roleCode) ?? roles[1];
      const created = {
        id: '00000000-0000-4000-8000-000000000002',
        name: input.name,
        email: input.email.toLowerCase(),
        active: true,
        role: { code: role?.code ?? '', name: role?.name ?? '' },
        permissions: [
          ...(role?.permissions ?? []),
          ...(input.commissionAccess ? ['commission.access'] : []),
        ],
        createdAt: '2026-08-02T12:05:00.000Z',
        updatedAt: '2026-08-02T12:05:00.000Z',
      };
      users = [...users, created];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { user: created } }),
      });
      return;
    }
    const match = pathname.match(/^\/api\/v1\/users\/([^/]+)\/(deactivate|activate)$/);
    if (match && request.method() === 'POST') {
      const id = match[1] ?? '';
      const active = match[2] === 'activate';
      users = users.map((user) => (user.id === id ? { ...user, active } : user));
      const user = users.find((item) => item.id === id);
      await route.fulfill({
        status: user ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(user ? { data: { user } } : { error: { code: 'USER_NOT_FOUND' } }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/usuarios');

  const screen = page.locator('#s-usuarios');
  await expect(screen).toBeVisible();
  await expect(screen.getByText('Administradora do Banco')).toBeVisible();
  await expect(screen.getByText('samara@fluair.com.br')).toHaveCount(0);

  const form = screen.locator('#users-create-form');
  await expect(form.getByLabel('Perfil').locator('option')).toHaveText(['Admin', 'Vendedor']);
  await expect(form.getByLabel('Perfil').locator('option')).toHaveCount(2);
  await form.getByLabel('Nome').fill('Operadora Real');
  await form.getByLabel('E-mail').fill('operadora@fluair.test');
  const initialPassword = form.getByLabel('Senha inicial', { exact: true });
  await initialPassword.fill('senha-inicial');
  await expect(initialPassword).toHaveAttribute('type', 'password');
  await form.getByRole('button', { name: 'Exibir senha inicial' }).click();
  await expect(initialPassword).toHaveAttribute('type', 'text');
  await expect(initialPassword).toHaveValue('senha-inicial');
  await form.getByRole('button', { name: 'Ocultar senha inicial' }).click();
  await expect(initialPassword).toHaveAttribute('type', 'password');
  await form.getByLabel('Perfil').selectOption('CALCULATION_OPERATOR');
  await form.getByLabel('Acesso a Comissões').check();
  await form.getByRole('button', { name: 'Criar usuário' }).click();

  await expect(screen.getByText('Usuário criado com sucesso.')).toBeVisible();
  const createdRow = screen.locator('[data-user-id="00000000-0000-4000-8000-000000000002"]');
  await expect(createdRow.getByText('Operadora Real')).toBeVisible();
  await expect(createdRow.getByText('Operador de cálculo')).toBeVisible();
  await expect(createdRow.getByText('3 permissões efetivas')).toBeVisible();

  await createdRow.getByRole('button', { name: 'Editar' }).click();
  const editModal = page.locator('#modal-editar-usuario');
  const newPassword = editModal.locator('#edit-senha');
  await newPassword.fill('nova-senha-segura');
  await editModal.getByRole('button', { name: 'Exibir nova senha' }).click();
  await expect(newPassword).toHaveAttribute('type', 'text');
  await expect(newPassword).toHaveValue('nova-senha-segura');
  await editModal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(newPassword).toHaveValue('');
  await expect(newPassword).toHaveAttribute('type', 'password');

  await createdRow.getByRole('button', { name: 'Desativar' }).click();
  const modal = page.locator('#modal-status-usuario');
  await expect(modal).toHaveClass(/open/);
  await expect(modal.getByText('Operadora Real perderá o acesso')).toBeVisible();
  await modal.getByRole('button', { name: 'Desativar usuário' }).click();
  await expect(modal).not.toHaveClass(/open/);
  await expect(modal).toHaveCSS('opacity', '0');
  await expect(createdRow.getByText('Desativado')).toBeVisible();

  await page.screenshot({ path: 'test-results/users-database.png', fullPage: true });
});
