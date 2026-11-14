import type { PushMessage, PushSubscriptionInput } from '@jobflow/shared';
import type { CDPSession, Page } from '@playwright/test';

import { uk } from '@/shared/i18n';
import { SUBSCRIPTION_INPUT } from '@/test/push-fixtures';

import {
  GRANT_BINDING,
  offerAfterSilence,
  offerToast,
  permissionAsks,
  pushSwitch,
} from './test/push';
import { expect, test } from './test/session';
import { apiAnswered } from './test/stack';

const OFFER = uk.push.offer;

function fakePushService(input: PushSubscriptionInput): void {
  const subscription = {
    endpoint: input.endpoint,
    expirationTime: null,
    options: { applicationServerKey: null, userVisibleOnly: true },
    getKey: () => null,
    toJSON: () => ({ ...input, expirationTime: null }),
    unsubscribe: () => Promise.resolve(true),
  };
  for (const method of ['subscribe', 'getSubscription']) {
    Object.defineProperty(PushManager.prototype, method, {
      value: () => Promise.resolve(subscription),
    });
  }
}

async function registrationIdOf(cdp: CDPSession, origin: string): Promise<string> {
  const ids: string[] = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
    for (const { scopeURL, registrationId } of registrations) {
      if (scopeURL === `${origin}/`) ids.push(registrationId);
    }
  });
  await cdp.send('ServiceWorker.enable');
  await expect.poll(() => ids.length).toBeGreaterThan(0);
  return ids[0] ?? '';
}

function shownNotifications(page: Page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const shown = await registration.getNotifications();
    return shown.map(({ title, tag }) => ({ title, tag }));
  });
}

async function deliverPush(page: Page, message: PushMessage): Promise<void> {
  const origin = new URL(page.url()).origin;
  const cdp = await page.context().newCDPSession(page);
  const registrationId = await registrationIdOf(cdp, origin);
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin,
    registrationId,
    data: JSON.stringify(message),
  });
}

test('enabling from the offer asks once, subscribes this browser and shows a delivered push', async ({
  page,
  request,
  user,
}) => {
  await page.exposeFunction(GRANT_BINDING, () =>
    page.context().grantPermissions(['notifications']),
  );
  await page.addInitScript(fakePushService, SUBSCRIPTION_INPUT);
  const applicationId = await offerAfterSilence({ page, request, user });

  const subscribed = apiAnswered(page, { method: 'POST', route: '/push/subscriptions' });
  const saved = apiAnswered(page, { method: 'PATCH', route: '/settings' });
  await offerToast(page).getByRole('button', { name: OFFER.enable }).click();
  expect((await subscribed).status()).toBe(201);
  expect((await saved).ok()).toBe(true);
  expect(await permissionAsks(page)).toBe(1);
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.scriptURL),
  ).toBe(new URL('/sw.js', page.url()).href);

  const message: PushMessage = {
    title: `Push e2e ${applicationId.slice(0, 8)}`,
    body: OFFER.silence,
    url: `/applications/${applicationId}`,
    tag: `application:${applicationId}`,
  };
  await deliverPush(page, message);
  await expect
    .poll(() => shownNotifications(page))
    .toContainEqual({ title: message.title, tag: message.tag });

  await page.goto('/settings');
  await expect(pushSwitch(page)).toBeChecked();
});
