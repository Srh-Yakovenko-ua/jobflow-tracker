import type { PushPublicKey } from '@jobflow/shared';
import type { Locator, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';
import { PUSH_PUBLIC_KEY } from '@/test/push-fixtures';

import { addByHand, uniqueCompany } from './applications';
import { reloadUntilVisible } from './reload';
import { apiUrl } from './stack';
import { makeSilent, type SilenceTrip } from './time-travel';
import { toastRegion } from './toasts';

export type OfferTrip = Readonly<{ page: Page }> & Omit<SilenceTrip, 'applicationId'>;

export const GRANT_BINDING = 'grantNotifications';

const PERMISSION_ASKS_KEY = 'jobflow.e2e.notification-asks';

function countPermissionAsks({ key, grant }: Readonly<{ key: string; grant: string }>): void {
  if (!('Notification' in window)) return;
  const ask = Notification.requestPermission.bind(Notification);
  Notification.requestPermission = async () => {
    sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) ?? '0') + 1));
    const allow: unknown = Reflect.get(window, grant);
    if (typeof allow === 'function') await Reflect.apply(allow, window, []);
    return ask();
  };
}

export async function watchPermissionAsks(page: Page): Promise<void> {
  await page.route(apiUrl('/push/public-key'), (route) =>
    route.fulfill({ json: { publicKey: PUSH_PUBLIC_KEY } satisfies PushPublicKey }),
  );
  await page.addInitScript(countPermissionAsks, { key: PERMISSION_ASKS_KEY, grant: GRANT_BINDING });
}

export function permissionAsks(page: Page): Promise<number> {
  return page.evaluate((key) => Number(sessionStorage.getItem(key) ?? '0'), PERMISSION_ASKS_KEY);
}

export function offerToast(page: Page): Locator {
  return toastRegion(page).getByRole('listitem').filter({ hasText: uk.push.offer.title });
}

export function pushSwitch(page: Page): Locator {
  return page.getByRole('switch', { name: uk.settings.notifications.push.title });
}

export async function offerAfterSilence({ page, request, user }: OfferTrip): Promise<string> {
  await watchPermissionAsks(page);
  const company = uniqueCompany('Push');
  const applicationId = await addByHand(page, { company, position: 'Frontend Engineer' });
  await makeSilent({ request, user, applicationId });
  await page.goto('/board');
  await reloadUntilVisible(page, offerToast(page));
  return applicationId;
}
