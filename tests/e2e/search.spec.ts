import { expect, test } from '@playwright/test';

const user = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Usuária de Teste',
  email: 'usuario@fluair.test',
  permissions: ['calculation.view'],
};

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.route('https://cdnjs.cloudflare.com/**', (route) => route.abort());
  await page.route('**/api/v1/media/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: { user, session: { expiresAt: new Date(Date.now() + 60_000).toISOString() } },
      }),
    }),
  );
});

test('não exibe cálculos demonstrativos na Busca', async ({ page }) => {
  await page.route('**/api/v1/calculations?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculations: [],
          filters: { priceLists: [] },
          pagination: { page: 1, pageSize: 30, total: 0, totalPages: 1 },
        },
      }),
    }),
  );
  await page.goto('/calculos');

  const searchScreen = page.locator('#s-busca');
  await expect(searchScreen).toBeVisible();
  await expect(searchScreen.locator('#busca-count')).toHaveText('0 cálculos encontrados');
  await expect(searchScreen.getByText('Nenhum cálculo encontrado')).toBeVisible();
  await expect(
    searchScreen.getByText('Quando um cálculo for salvo, ele aparecerá aqui.'),
  ).toBeVisible();
  await expect(searchScreen.getByText('130001', { exact: true })).toHaveCount(0);
  await expect(searchScreen.locator('#recentes-body')).toHaveCount(0);
  await expect(searchScreen.locator('#result-area')).toHaveCount(0);
  await expect(searchScreen.locator('#busca-pg')).toBeEmpty();

  await page.screenshot({ path: 'test-results/search-empty.png', fullPage: true });
});

test('exibe e ordena os cálculos salvos preservando os filtros na URL', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/api/v1/calculations?**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          calculations: [
            {
              id: '50000000-0000-4000-8000-000000000001',
              kitCode: '00130001',
              kitDescription: 'KIT CONDENSADOR CALCULADO Usuario: Samara',
              reference: 'REF-KIT-001',
              priceList: {
                id: '20000000-0000-4000-8000-000000000001',
                code: 'IMPLEMENTER',
                name: 'Implementador',
              },
              minimumTotal: '4287.5000',
              normalTotal: '5130.0000',
              version: 1,
              createdAt: '2026-09-15T17:32:00.000Z',
              createdBy: 'Samara',
              current: true,
              image: {
                id: '70000000-0000-4000-8000-000000000001',
                thumbnailUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/thumb',
                displayUrl: '/api/v1/media/70000000-0000-4000-8000-000000000001/display',
                width: 1200,
                height: 900,
                updatedAt: '2026-09-15T17:30:00.000Z',
              },
            },
          ],
          filters: {
            priceLists: [
              {
                id: '20000000-0000-4000-8000-000000000001',
                code: 'IMPLEMENTER',
                name: 'Implementador',
              },
            ],
          },
          pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
        },
      }),
    });
  });

  await page.goto('/calculos');
  const searchScreen = page.locator('#s-busca');
  await expect(searchScreen.locator('#bsh-code')).toHaveText('Código');
  await expect(searchScreen.locator('#busca-count')).toHaveText('1 cálculo encontrado');
  const cells = searchScreen.locator('#busca-tbody tr').first().locator('td');
  await expect(cells.nth(0).getByRole('button', { name: /Ampliar foto/ })).toBeVisible();
  await expect(cells.nth(1)).toHaveText('00130001');
  await expect(cells.nth(2)).toHaveText('KIT CONDENSADOR CALCULADO');
  await expect(cells.nth(3)).toHaveText('REF-KIT-001');
  await expect(cells.nth(4)).toHaveText('Implementador');
  await expect(cells.nth(5)).toHaveText('R$ 4.287,50');
  await expect(cells.nth(6)).toHaveText('R$ 5.130,00');
  await expect(cells.nth(8)).toHaveText('Samara');
  await expect(cells.nth(9).getByRole('button', { name: 'Ver' })).toBeVisible();

  await searchScreen.locator('#busca-q').fill('condensador');
  await expect(page).toHaveURL(/q=condensador/);
  await searchScreen.locator('#bsh-tabMin').click();
  await expect(page).toHaveURL(/ordem=minimumTotal/);
  await expect.poll(() => requests.at(-1)).toContain('sort=minimumTotal');
  await expect.poll(() => requests.at(-1)).toContain('search=condensador');

  const priceVisibility = page.getByRole('switch', {
    name: 'Ocultar valores mínimos e normais',
  });
  await page.locator('label[for="hide-reference-prices"]').click();
  await expect(priceVisibility).toBeChecked();
  await expect(searchScreen.locator('#bsh-tabMin')).toBeHidden();
  await expect(searchScreen.locator('#bsh-tabNor')).toBeHidden();
  await expect(cells.nth(5)).toBeHidden();
  await expect(cells.nth(6)).toBeHidden();

  await page.reload();
  await expect(priceVisibility).toBeChecked();
  await expect(searchScreen.locator('#bsh-tabMin')).toBeHidden();
});
