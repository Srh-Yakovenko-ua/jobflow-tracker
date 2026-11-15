import type { Page } from '@playwright/test';

import { uk } from '@/shared/i18n';

const COPY = uk.bookmarklet;

async function issueToken(page: Page): Promise<void> {
  const create = page.getByRole('button', { name: COPY.create, exact: true });
  const renew = page.getByRole('button', { name: COPY.regenerate.action, exact: true });
  await create.or(renew).first().waitFor();
  if (await create.isVisible()) {
    await create.click();
    return;
  }
  await renew.click();
  await page
    .getByRole('alertdialog', { name: COPY.regenerate.dialog.title })
    .getByRole('button', { name: COPY.regenerate.dialog.confirm, exact: true })
    .click();
}

export async function bookmarkletCode(page: Page): Promise<string> {
  await page.goto('/add');
  await issueToken(page);
  const link = page.getByRole('main').getByRole('link', { name: COPY.button, exact: true });
  const href = await link.getAttribute('href');
  if (href === null) throw new Error('the bookmarklet button has no href');
  return decodeURIComponent(new URL(href).pathname);
}
