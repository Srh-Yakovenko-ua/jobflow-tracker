import type { Page } from '@playwright/test';

import { addByHand, uniqueCompany } from './test/applications';
import { seriousViolations } from './test/axe';
import { expect, signedOutTest, test } from './test/session';
import { toastRegion } from './test/toasts';

const SCHEMES = ['light', 'dark'] as const;

const SIGNED_OUT_PAGES = ['/login', '/register'];

const SIGNED_IN_PAGES = [
  '/board',
  '/applications',
  '/calendar',
  '/add',
  '/analytics',
  '/reminders',
  '/notifications',
  '/resumes',
  '/settings',
];

async function expectAccessible(page: Page, route: string): Promise<void> {
  await test.step(route, async () => {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(toastRegion(page)).toBeAttached();
    expect(await seriousViolations(page)).toEqual([]);
  });
}

for (const colorScheme of SCHEMES) {
  signedOutTest(
    `the signed-out pages have no serious axe violations in ${colorScheme}`,
    async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      for (const route of SIGNED_OUT_PAGES) {
        await expectAccessible(page, route);
      }
    },
  );

  test(`the signed-in pages have no serious axe violations in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    const applicationId = await addByHand(page, {
      company: uniqueCompany('A11y'),
      position: 'Frontend Developer',
    });
    for (const route of [...SIGNED_IN_PAGES, `/applications/${applicationId}`]) {
      await expectAccessible(page, route);
    }
  });
}

signedOutTest('reduced motion turns the duration token to zero', async ({ page }) => {
  await page.goto('/login');
  const duration = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--duration-base').trim(),
  );
  expect(Number.parseFloat(duration)).toBe(0);
});
