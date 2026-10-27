import { expect, test } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
} from './helpers/responsive-layout.js';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Não autenticado.' } }),
    }),
  );
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  await page.goto('/login');
});

test('protege modal longo, ações, texto e tabela rolável sem overflow global', async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement('section');
    fixture.id = 'responsive-foundation-fixture';
    fixture.style.cssText = 'width:100%;padding:8px';
    fixture.innerHTML = `
      <div id="long-flex" style="display:flex;max-width:100%;gap:8px">
        <span style="flex:1">${'referencia-sem-quebra-'.repeat(20)}</span>
        <button class="btn" type="button">Ação</button>
      </div>
      <div class="responsive-table-region" id="wide-table" style="max-width:600px">
        <div style="width:2000px;height:60px">Conteúdo comparativo amplo</div>
      </div>
      <div class="modal-overlay open" id="foundation-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="foundation-title">
          <div class="modal-header">
            <div class="modal-title" id="foundation-title">Modal compartilhado</div>
            <button class="modal-close" type="button" aria-label="Fechar">×</button>
          </div>
          <label for="foundation-input">Campo próximo ao rodapé</label>
          <div style="height:1200px">Conteúdo longo</div>
          <input class="inp" id="foundation-input" value="valor">
          <div class="modal-footer">
            <button class="btn" type="button">Cancelar</button>
            <button class="btn btn-primary" type="button">Confirmar</button>
          </div>
        </div>
      </div>`;
    document.body.append(fixture);
  });

  const table = page.locator('#wide-table');
  await expect(table).toHaveAttribute('tabindex', '0');
  await expect(table).toHaveAttribute('data-scrollable', 'true');
  await table.focus();
  await expect(table).toBeFocused();
  await table.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(table).toHaveAttribute('data-scroll-end', 'true');

  const modal = page.locator('#foundation-modal .modal');
  const scrollSizes = await modal.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(scrollSizes.scrollHeight).toBeGreaterThan(scrollSizes.clientHeight);
  await assertElementWithinViewport(modal);
  await modal.getByLabel('Campo próximo ao rodapé').scrollIntoViewIfNeeded();
  await assertElementWithinViewport(modal.getByRole('button', { name: 'Confirmar' }));
  await assertMinimumInteractiveArea(modal.getByRole('button', { name: 'Fechar' }));
  await assertMinimumInteractiveArea(modal.getByRole('button', { name: 'Confirmar' }));
  await assertNoDocumentHorizontalOverflow(page);
});

test('remove animações não essenciais quando movimento reduzido é solicitado', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('.login-card').evaluate((element) => {
    element.style.transition = 'transform 5s';
    return getComputedStyle(element).transitionDuration;
  });
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
