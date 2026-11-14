import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

import { expect } from './session';

const TOASTER_HOTKEY = 'Alt+KeyT';

export function toastRegion(page: Page): Locator {
  return page.getByRole('region', { name: uk.app.notifications });
}

async function tabTo(page: Page, target: Locator): Promise<void> {
  await expect(async () => {
    await page.keyboard.press('Tab');
    await expect(target).toBeFocused({ timeout: 200 });
  }).toPass();
}

export async function dismissToastByKeyboard(page: Page, title: string): Promise<void> {
  const toast = toastRegion(page).getByRole('listitem').filter({ hasText: title });
  await page.keyboard.press(TOASTER_HOTKEY);
  await tabTo(page, toast.getByRole('button', { name: uk.app.close }));
  await page.keyboard.press('Enter');
  await expect(toast).toBeHidden();
}
