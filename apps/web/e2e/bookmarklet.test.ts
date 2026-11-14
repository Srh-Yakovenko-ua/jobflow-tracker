import type { Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { COPY_UK } from '../../../bookmarklet/src/copy-uk';
import { DJINNI_PAGE, DOU_PAGE } from '../../../bookmarklet/src/test/fixtures/pages';
import type { PageFixture } from '../../../bookmarklet/src/test/page';
import { expect, test } from './test/session';

type VacancySite = Readonly<{ origin: string; fixture: PageFixture }>;

const DOU: VacancySite = { origin: 'https://dou.ua', fixture: DOU_PAGE };

const DJINNI: VacancySite = { origin: 'https://djinni.co', fixture: DJINNI_PAGE };

const JAVASCRIPT_SCHEME = 'javascript:';

async function installedCode(page: Page): Promise<string> {
  await page.goto('/add');
  await page.getByRole('button', { name: uk.bookmarklet.create }).click();
  const href = await page.locator(`a[href^="${JAVASCRIPT_SCHEME}"]`).getAttribute('href');
  expect(href).not.toBeNull();
  return decodeURIComponent((href ?? '').slice(JAVASCRIPT_SCHEME.length));
}

function documentOf({ title = '', html }: PageFixture): string {
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`;
}

async function openVacancy(page: Page, site: VacancySite): Promise<void> {
  await page.route(`${site.origin}/**`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: documentOf(site.fixture) }),
  );
  await page.goto(`${site.origin}${site.fixture.path ?? '/'}`);
}

function toast(page: Page) {
  return page.locator('jobflow-toast').getByRole('status');
}

async function click(page: Page, code: string): Promise<void> {
  await page.evaluate(code);
}

async function openCardHref(page: Page, code: string): Promise<string | null> {
  await click(page, code);
  await expect(toast(page)).toContainText(COPY_UK.added);
  return toast(page).getByRole('link', { name: COPY_UK.openCard }).getAttribute('href');
}

test('the bookmarklet adds a DOU vacancy once and says a changed Djinni page was already added', async ({
  page,
}) => {
  const code = await installedCode(page);

  await openVacancy(page, DOU);
  const first = await openCardHref(page, code);
  expect(first).toMatch(/\/applications\/[\da-f-]+$/u);
  await openVacancy(page, DOU);
  expect(await openCardHref(page, code)).toBe(first);

  await openVacancy(page, DJINNI);
  await openCardHref(page, code);
  await page.locator('h1').evaluate((heading) => {
    heading.textContent = `${heading.textContent} · оновлено`;
  });
  await click(page, code);
  await expect(toast(page)).toContainText(COPY_UK.repeated);
});
