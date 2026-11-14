import { uk } from '@/shared/i18n';

import {
  offerAfterSilence,
  offerToast,
  permissionAsks,
  pushSwitch,
  watchPermissionAsks,
} from './test/push';
import { expect, signedOutTest, test } from './test/session';

const FIRST_VISIT_PATHS = ['/board', '/applications', '/settings'] as const;

const NO_REDIRECT = { maxRedirects: 0 } as const;

test('a first visit asks for no notification permission and offers no push', async ({ page }) => {
  await watchPermissionAsks(page);
  for (const path of FIRST_VISIT_PATHS) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
  }
  await expect(pushSwitch(page)).toBeVisible();

  expect(await permissionAsks(page)).toBe(0);
  await expect(offerToast(page)).toBeHidden();
});

signedOutTest('the service worker and its icon load without a session', async ({ request }) => {
  const worker = await request.get('/sw.js', NO_REDIRECT);
  const icon = await request.get('/icons/jobflow-192.png', NO_REDIRECT);

  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toMatch(/javascript/u);
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toBe('image/png');
});

test('a silent card brings the push offer, and not now keeps it away after a reload', async ({
  page,
  request,
  user,
}) => {
  await offerAfterSilence({ page, request, user });

  await offerToast(page).getByRole('button', { name: uk.push.offer.later }).click();
  await expect(offerToast(page)).toBeHidden();
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();

  await expect(offerToast(page)).toBeHidden();
  expect(await permissionAsks(page)).toBe(0);
});
