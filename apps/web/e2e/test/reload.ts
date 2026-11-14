import type { Locator, Page } from '@playwright/test';

import { expect } from './session';
import { WORKER_WAIT } from './stack';

const PER_LOAD = { timeout: 5_000 } as const;

export async function reloadUntilVisible(page: Page, target: Locator): Promise<void> {
  await expect(async () => {
    try {
      await expect(target).toBeVisible(PER_LOAD);
    } catch (missing) {
      await page.reload();
      throw missing;
    }
  }).toPass(WORKER_WAIT);
}
