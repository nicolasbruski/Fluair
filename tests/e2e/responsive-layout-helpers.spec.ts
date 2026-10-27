import { expect, test } from '@playwright/test';

import {
  assertElementWithinViewport,
  assertElementsDoNotOverlap,
  assertMinimumInteractiveArea,
  assertNoDocumentHorizontalOverflow,
} from './helpers/responsive-layout.js';

test.describe('helpers objetivos de layout', () => {
  test('distingue overflow interno permitido de overflow global', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.setContent(`
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>html,body{margin:0}.scroll-region{width:280px;overflow:auto}.wide{width:600px}</style>
      <div class="scroll-region"><div class="wide">conteúdo rolável</div></div>
    `);
    await assertNoDocumentHorizontalOverflow(page);
    await page.locator('body').evaluate((body) => {
      const overflow = document.createElement('div');
      overflow.style.width = '500px';
      overflow.style.height = '1px';
      overflow.style.position = 'absolute';
      overflow.style.left = '0';
      body.append(overflow);
    });
    await expect(assertNoDocumentHorizontalOverflow(page)).rejects.toThrow(
      /documento excedeu a viewport/i,
    );
  });

  test('falha de forma controlada para elemento fora da viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.setContent(`
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <button style="position:fixed;left:330px;top:10px">Fora</button>
    `);
    await expect(assertElementWithinViewport(page.getByRole('button'))).rejects.toThrow();
  });

  test('mede área interativa e interseção entre controles', async ({ page }) => {
    await page.setContent(`
      <button id="a" style="position:fixed;left:0;top:0;width:44px;height:44px">A</button>
      <button id="b" style="position:fixed;left:60px;top:0;width:44px;height:44px">B</button>
    `);
    await assertMinimumInteractiveArea(page.locator('#a'));
    await assertElementsDoNotOverlap(page.locator('#a'), page.locator('#b'));
    await page.locator('#b').evaluate((button) => {
      button.style.left = '20px';
    });
    await expect(
      assertElementsDoNotOverlap(page.locator('#a'), page.locator('#b')),
    ).rejects.toThrow(/sobrepõem/i);
  });
});
