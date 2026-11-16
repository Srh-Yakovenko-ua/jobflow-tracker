import { buildDesignOffers, type DesignOfferCount } from '@jobflow/shared/testing';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { seriousViolations } from './test/axe';
import { routeDesignOffers } from './test/offers';
import { paperOf, printedA4Pages } from './test/print';
import { expect, test } from './test/session';

const COPY = uk.offerCompare;

const WIDE = { width: 1440, height: 900 } as const;

const NARROW = { width: 390, height: 844 } as const;

const COUNTS: readonly DesignOfferCount[] = [2, 3, 4];

const MAX_PRINTED_PAGES = 2;

const [TRIDENT = '', NORTHWIND = '', LUMEN = ''] = buildDesignOffers(3).map(
  ({ company }) => company,
);

function rankedCompanies(page: Page): Promise<string[]> {
  return page
    .getByRole('region', { name: COPY.ranking })
    .getByRole('heading', { level: 3 })
    .allInnerTexts();
}

function slider(page: Page, name: string): Locator {
  return page.getByRole('slider', { name, exact: true });
}

function column(page: Page, company: string): Locator {
  return page.getByRole('article', { name: company });
}

async function openComparison(page: Page, count: DesignOfferCount): Promise<void> {
  await routeDesignOffers(page, count);
  await page.goto('/offers/compare');
  await expect(page.getByRole('region', { name: COPY.ranking })).toBeVisible();
}

for (const viewport of [WIDE, NARROW]) {
  for (const count of COUNTS) {
    test(`${String(count)} offers at ${String(viewport.width)} px all show, scroll no sideways and pass axe`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const offers = await routeDesignOffers(page, count);
      await page.goto('/offers/compare');

      for (const { company } of offers) {
        await expect(page.getByRole('heading', { level: 3, name: company })).toBeVisible();
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}

test('moving the money weight with the keyboard reorders the offers', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openComparison(page, 3);
  await slider(page, COPY.weights.criteria.format).press('Home');
  await slider(page, COPY.weights.criteria.stack).press('End');
  await expect.poll(() => rankedCompanies(page)).toEqual([TRIDENT, NORTHWIND, LUMEN]);

  await slider(page, COPY.weights.criteria.money).press('Home');

  await expect.poll(() => rankedCompanies(page)).toEqual([NORTHWIND, TRIDENT, LUMEN]);
});

test('unticking a benefit that drops its offer a place keeps focus on that checkbox', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await openComparison(page, 3);
  const northwind = column(page, NORTHWIND);
  for (const benefit of Object.values(COPY.column.benefit)) {
    await northwind.getByRole('checkbox', { name: benefit }).click();
  }
  await northwind.getByRole('radio', { name: '2', exact: true }).click();
  await expect.poll(() => rankedCompanies(page)).toEqual([NORTHWIND, TRIDENT, LUMEN]);
  const vacation = northwind.getByRole('checkbox', { name: COPY.column.benefit.vacation });

  await vacation.click();

  await expect.poll(() => rankedCompanies(page)).toEqual([TRIDENT, NORTHWIND, LUMEN]);
  await expect(vacation).toBeFocused();
});

test('under a dark scheme the print view stays a light sheet and four offers print on at most 2 A4 pages', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await routeDesignOffers(page, 4);
  await page.goto('/offers/compare/print');
  await expect(page.getByRole('heading', { level: 3 })).toHaveCount(4);
  const root = page.locator('html');
  const lightPaper = await paperOf(root);

  await page.emulateMedia({ colorScheme: 'dark' });

  expect(await paperOf(root)).not.toBe(lightPaper);
  expect(await paperOf(page.locator('main [data-theme="light"]'))).toBe(lightPaper);
  expect(await printedA4Pages(page)).toBeLessThanOrEqual(MAX_PRINTED_PAGES);
});
