import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('carrega, filtra e cria clientes mantendo os campos de comissões', async ({ page }) => {
  const source = await readFile('Comissoes/sistema_comissao_v3.html', 'utf8');
  const customers = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      code: 'C01619',
      legalName: 'Expresso Figueiredo',
      segment: 'FROTISTA',
      customerClass: null,
      customerSegment: { id: 'segment-1', code: 'FLEET_OWNER', name: 'Frotista', active: true },
      seller: 'Marcelo Ort',
      representative: null,
      internalNote: null,
      orderNote: null,
      active: true,
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      code: 'C02000',
      legalName: 'Autopeças Normalizada',
      segment: null,
      customerClass: null,
      customerSegment: { id: 'segment-2', code: 'AUTO_PARTS', name: 'Autopeças', active: true },
      seller: 'Fernando',
      representative: 'Five',
      internalNote: null,
      orderNote: null,
      active: true,
      createdAt: '2026-08-02T12:00:00.000Z',
      updatedAt: '2026-08-02T12:00:00.000Z',
    },
  ];
  let createdPayload: Record<string, unknown> | undefined;

  await page.route('**/comissoes', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: source }),
  );
  await page.route('**/api/v1/commissions/customers', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { customers } }),
      });
      return;
    }

    createdPayload = route.request().postDataJSON() as Record<string, unknown>;
    const customer = {
      ...customers[0],
      ...createdPayload,
      id: '10000000-0000-4000-8000-000000000003',
      representative: null,
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { customer } }),
    });
  });

  await page.goto('/comissoes');
  await page.getByRole('button', { name: 'Clientes' }).click();
  await expect(page.locator('#cliBody tr')).toHaveCount(2);
  await expect(page.locator('#cliSeg')).toContainText('FROTISTA');
  await expect(page.locator('#cliSeg')).toContainText('Autopeças');

  await page.locator('#cliSeg').selectOption('FROTISTA');
  await expect(page.locator('#cliBody tr')).toHaveCount(1);
  await expect(page.locator('#cliBody')).toContainText('Expresso Figueiredo');
  await expect(page.locator('#cliBody')).not.toContainText(/Visualizar|Editar|Excluir/);
  await expect(page.locator('#cliBody').getByRole('button')).toHaveCount(0);

  await page.locator('#cliSeg').selectOption('');
  await page.getByRole('button', { name: '+ Adicionar cliente' }).click();
  await page.locator('#nCod').fill('c03000');
  await page.locator('#nRazao').fill('Cliente das Comissões');
  await page.locator('#nSeg').selectOption('FROTISTA');
  await page.locator('#nVend').fill('Fernando');
  await page.getByRole('button', { name: 'Adicionar cliente', exact: true }).click();

  await expect(page.locator('#cliBody')).toContainText('C03000');
  expect(createdPayload).toMatchObject({
    code: 'C03000',
    legalName: 'Cliente das Comissões',
    segment: 'FROTISTA',
    seller: 'Fernando',
    representative: '',
  });
});
