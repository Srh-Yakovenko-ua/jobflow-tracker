import { DEMO_USER } from '@jobflow/shared';
import { salaryFloorInsightsBody } from '@jobflow/shared/testing';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { routeDesignAnalytics } from './test/analytics-fixture';
import { expect, signedOutTest, signIn, test } from './test/session';

const COPY = uk.analytics;

const REPORT = COPY.report;

const PRINT_PIXEL_RATIO = 3;

const PAGE_OBJECT = /\/Type\s*\/Page(?!s)/g;

async function openReport(page: Page): Promise<void> {
  await page.goto('/analytics/report');
  await expect(page.getByRole('list', { name: COPY.blocks.sankey.funnel })).toBeVisible();
  await expect(page.getByRole('region', { name: COPY.blocks.forecast.eyebrow })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

function paperOf(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).getPropertyValue('--paper').trim());
}

function salaryInsightTitle(): string {
  const insight = salaryFloorInsightsBody().insights.find(({ block }) => block === 'salary');
  if (insight === undefined) throw new Error('the salary fixture has no salary insight');
  return insight.title;
}

signedOutTest('the demo report prints on 3 or 4 A4 pages', async ({ page }) => {
  await signIn(page, DEMO_USER);
  await openReport(page);

  const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');

  const pages = pdf.match(PAGE_OBJECT)?.length ?? 0;
  expect(pages).toBeGreaterThanOrEqual(3);
  expect(pages).toBeLessThanOrEqual(4);
});

test('under a dark scheme the report stays a light sheet and draws its charts at print resolution', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await routeDesignAnalytics(page);
  await openReport(page);
  const root = page.locator('html');
  const island = page.locator('main [data-theme="light"]');
  const lightPaper = await paperOf(root);

  await page.emulateMedia({ colorScheme: 'dark' });

  expect(await paperOf(root)).not.toBe(lightPaper);
  expect(await paperOf(island)).toBe(lightPaper);
  const ratios = await island
    .locator('canvas')
    .evaluateAll((canvases: HTMLCanvasElement[]) =>
      canvases
        .filter((canvas) => canvas.clientWidth > 0)
        .map((canvas) => canvas.width / canvas.clientWidth),
    );
  expect(ratios.length).toBeGreaterThan(0);
  for (const ratio of ratios) expect(ratio).toBeCloseTo(PRINT_PIXEL_RATIO, 1);
});

test('with salary hidden the printed report holds no dollar amount, no salary insight, no toolbar and no shell chrome', async ({
  page,
}) => {
  const salaryTitle = salaryInsightTitle();
  await routeDesignAnalytics(page, { insights: salaryFloorInsightsBody() });
  await openReport(page);
  await expect(page.getByRole('heading', { name: salaryTitle })).toBeVisible();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation').first()).toBeVisible();

  await page.getByRole('switch', { name: REPORT.hideSalary }).click();
  await expect(page.getByRole('heading', { name: salaryTitle })).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });

  const printed = await page.locator('main').innerText();
  expect(printed).not.toContain('$');
  expect(printed).not.toContain(salaryTitle);
  await expect(page.getByRole('button', { name: REPORT.print })).toBeHidden();
  await expect(page.getByRole('switch', { name: REPORT.hideSalary })).toBeHidden();
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
