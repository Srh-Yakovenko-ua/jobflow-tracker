import type { Page } from '@playwright/test';

import { API_CLIENT_LIMITS } from '@/shared/api/transport';
import { uk } from '@/shared/i18n';

import { expect, test } from './test/session';
import { API_ROUTES } from './test/stack';

const LOAD_FAILED = uk.states.errors.loadFailed;

function loadFailed(page: Page) {
  return page.getByRole('alert').filter({ hasText: LOAD_FAILED.title });
}

test.describe('the API is down', () => {
  test('a refused API keeps the session, and the tab is back on the board once it answers', async ({
    page,
  }) => {
    await page.route(API_ROUTES, (route) => route.abort('connectionrefused'));
    await page.reload();
    await expect(loadFailed(page)).toBeVisible();
    await expect(page).toHaveURL(/\/board$/u);

    await page.unroute(API_ROUTES);
    await page.goto('/register');
    await page.goto('/board');
    await expect(page).toHaveURL(/\/board$/u);
    await expect(loadFailed(page)).toBeHidden();
  });

  test('a hanging API times out into the error state and the tab stays on its page', async ({
    page,
  }) => {
    await page.clock.install();
    await page.route(API_ROUTES, () => new Promise<void>(() => undefined));
    await page.reload();

    await expect(async () => {
      await page.clock.runFor(API_CLIENT_LIMITS.requestTimeoutMs);
      await expect(loadFailed(page)).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expect(page).toHaveURL(/\/board$/u);
  });
});
