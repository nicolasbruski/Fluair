import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, type Locator, type Page, type Response, type TestInfo } from '@playwright/test';

interface ScreenshotIdentity {
  route: string;
  state: string;
}

interface ApiAudit {
  failures: string[];
  stop: () => void;
}

function rectangleDescription(
  box: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>,
): string {
  return `x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`;
}

function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'root'
  );
}

export async function assertNoDocumentHorizontalOverflow(page: Page, tolerance = 1): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
  }));
  const overflow =
    Math.max(dimensions.documentScrollWidth, dimensions.bodyScrollWidth) -
    dimensions.documentClientWidth;
  expect(
    overflow,
    `O documento excedeu a viewport em ${overflow}px: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(tolerance);
}

export async function assertElementWithinViewport(locator: Locator, tolerance = 1): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  expect(box, 'O elemento visível deve possuir bounding box.').not.toBeNull();
  expect(viewport, 'O teste deve possuir uma viewport explícita.').not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x, rectangleDescription(box)).toBeGreaterThanOrEqual(-tolerance);
  expect(box.y, rectangleDescription(box)).toBeGreaterThanOrEqual(-tolerance);
  expect(box.x + box.width, rectangleDescription(box)).toBeLessThanOrEqual(
    viewport.width + tolerance,
  );
  expect(box.y + box.height, rectangleDescription(box)).toBeLessThanOrEqual(
    viewport.height + tolerance,
  );
}

export async function assertElementsDoNotOverlap(
  first: Locator,
  second: Locator,
  tolerance = 0,
): Promise<void> {
  const [firstBox, secondBox] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(firstBox, 'O primeiro elemento deve possuir bounding box.').not.toBeNull();
  expect(secondBox, 'O segundo elemento deve possuir bounding box.').not.toBeNull();
  if (!firstBox || !secondBox) return;
  const intersectionWidth =
    Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
    Math.max(firstBox.x, secondBox.x);
  const intersectionHeight =
    Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
    Math.max(firstBox.y, secondBox.y);
  expect(
    intersectionWidth > tolerance && intersectionHeight > tolerance,
    `Os controles se sobrepõem: primeiro (${rectangleDescription(firstBox)}), segundo (${rectangleDescription(secondBox)}).`,
  ).toBe(false);
}

export async function assertMinimumInteractiveArea(
  locator: Locator,
  minimum = { width: 44, height: 44 },
): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'O controle deve possuir bounding box.').not.toBeNull();
  if (!box) return;
  expect(box.width, rectangleDescription(box)).toBeGreaterThanOrEqual(minimum.width);
  expect(box.height, rectangleDescription(box)).toBeGreaterThanOrEqual(minimum.height);
}

export async function captureResponsiveScreenshot(
  page: Page,
  testInfo: TestInfo,
  identity: ScreenshotIdentity,
): Promise<string> {
  const directory = join('test-results', 'responsiveness', slug(testInfo.project.name));
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${slug(identity.route)}--${slug(identity.state)}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

export function auditApiFailures(
  page: Page,
  allowedFailure?: (response: Response) => boolean,
): ApiAudit {
  const failures: string[] = [];
  const onResponse = (response: Response): void => {
    if (!response.url().includes('/api/v1/') || response.status() < 400) return;
    if (!allowedFailure?.(response)) failures.push(`${response.status()} ${response.url()}`);
  };
  const onRequestFailed = (request: {
    url: () => string;
    failure: () => { errorText: string } | null;
  }): void => {
    if (!request.url().includes('/api/v1/')) return;
    failures.push(`${request.failure()?.errorText ?? 'request failed'} ${request.url()}`);
  };
  page.on('response', onResponse);
  page.on('requestfailed', onRequestFailed);
  return {
    failures,
    stop: () => {
      page.off('response', onResponse);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

export function assertNoUnexpectedApiFailures(audit: ApiAudit): void {
  expect(audit.failures, `Falhas de API não previstas:\n${audit.failures.join('\n')}`).toEqual([]);
}
