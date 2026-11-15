import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { addByHand, uniqueCompany } from './test/applications';
import { seriousViolations } from './test/axe';
import { SIGNED_IN_PAGES, SIGNED_OUT_PAGES } from './test/routes';
import { expect, signedOutTest, test } from './test/session';
import { toastRegion } from './test/toasts';

const SCHEMES = ['light', 'dark'] as const;

const NARROW = { width: 390, height: 844 } as const;

const TAB_LIMIT = 40;

const CSP_MARK = 'Content Security Policy';

const HIT_REACH = 21;

const DATA_DELETION = uk.settings.aiPrivacy.dataDeletion;

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

function cspErrorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes(CSP_MARK)) errors.push(message.text());
  });
  return errors;
}

async function firstTabbedRegion(
  page: Page,
  regions: Readonly<Record<string, Locator>>,
): Promise<string | null> {
  await page.getByRole('heading', { level: 1 }).click();
  for (let step = 0; step < TAB_LIMIT; step += 1) {
    await page.keyboard.press('Tab');
    for (const [name, region] of Object.entries(regions)) {
      const focused = await region.evaluate((element) => element.contains(document.activeElement));
      if (focused) return name;
    }
  }
  return null;
}

async function hitsAroundCentre(button: Locator): Promise<boolean[]> {
  return button.evaluate((element, reach) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    return [y - reach, y + reach].map((pointY) => {
      const hit = document.elementFromPoint(x, pointY);
      return hit !== null && element.contains(hit);
    });
  }, HIT_REACH);
}

async function expectConfirmHitArea(page: Page): Promise<void> {
  await test.step('/settings delete confirm', async () => {
    await page.goto('/settings');
    await page.getByRole('button', { name: DATA_DELETION.action, exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: DATA_DELETION.dialog.title });
    await expect(confirm).toBeVisible();
    for (const name of [DATA_DELETION.dialog.cancel, DATA_DELETION.dialog.confirm]) {
      const button = confirm.getByRole('button', { name, exact: true });
      expect(await hitsAroundCentre(button), name).toEqual([true, true]);
    }
    for (const colorScheme of SCHEMES) {
      await page.emulateMedia({ colorScheme });
      expect(await seriousViolations(page), colorScheme).toEqual([]);
    }
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
    const cspErrors = cspErrorsOf(page);
    const applicationId = await addByHand(page, {
      company: uniqueCompany('A11y'),
      position: 'Frontend Developer',
    });
    for (const route of [...SIGNED_IN_PAGES, `/applications/${applicationId}`]) {
      await expectAccessible(page, route);
    }
    expect(cspErrors).toEqual([]);
  });
}

test('at 390 px the notifications and application pages pass axe, Tab meets the follow-up before the notes and the open confirm takes a 44 px touch and passes axe in light and dark', async ({
  page,
}) => {
  const applicationId = await addByHand(page, {
    company: uniqueCompany('Narrow'),
    position: 'Frontend Developer',
  });
  await page.setViewportSize(NARROW);
  for (const route of ['/notifications', `/applications/${applicationId}`]) {
    await expectAccessible(page, route);
  }
  const main = page.getByRole('main');
  const followup = main.getByRole('region', { name: uk.followup.kicker });
  await expect(followup).toBeVisible();

  expect(
    await firstTabbedRegion(page, {
      followup,
      notes: main.getByRole('region', { name: uk.applicationPage.notes.kicker }),
    }),
  ).toBe('followup');
  await expectConfirmHitArea(page);
});

test('at 390 px no signed-in page scrolls sideways', async ({ page }) => {
  const applicationId = await addByHand(page, {
    company: uniqueCompany('Reflow'),
    position: 'Frontend Developer',
  });
  await page.setViewportSize(NARROW);
  for (const route of [...SIGNED_IN_PAGES, `/applications/${applicationId}`]) {
    await test.step(route, async () => {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

signedOutTest('reduced motion turns the duration token to zero', async ({ page }) => {
  await page.goto('/login');
  const duration = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--duration-base').trim(),
  );
  expect(Number.parseFloat(duration)).toBe(0);
});
