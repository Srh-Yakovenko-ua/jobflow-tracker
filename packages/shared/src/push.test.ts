import { describe, expect, it } from 'vitest';

import {
  type PushMessage,
  pushMessageSchema,
  pushPublicKeySchema,
  type PushSubscriptionInput,
  pushSubscriptionInputSchema,
} from './push.js';
import { issuePathsOf } from './test/zod-issues.js';

const SUBSCRIPTION: PushSubscriptionInput = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/cX1yZ2:APA91bHk3',
  keys: { p256dh: 'B'.repeat(87), auth: 'a1_-'.repeat(5) + 'Zz' },
};

const MESSAGE: PushMessage = {
  title: 'Тиша вже 7 днів',
  body: 'Acme',
  url: '/applications/0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f#follow-up',
  tag: 'application:0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e1f',
};

describe('pushSubscriptionInputSchema', () => {
  it.each([
    ['an FCM endpoint', SUBSCRIPTION.endpoint],
    ['a Mozilla endpoint', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAA'],
    ['an Apple endpoint', 'https://web.push.apple.com/QGm1tRj'],
    ['a Windows endpoint', 'https://wns2-db5p.notify.windows.com/w/?token=BQYAAA'],
  ])('accepts %s', (_label, endpoint) => {
    expect(pushSubscriptionInputSchema.parse({ ...SUBSCRIPTION, endpoint })).toStrictEqual({
      ...SUBSCRIPTION,
      endpoint,
    });
  });

  it('drops the expiration time the browser adds', () => {
    expect(
      pushSubscriptionInputSchema.parse({ ...SUBSCRIPTION, expirationTime: null }),
    ).toStrictEqual(SUBSCRIPTION);
  });

  it.each([
    ['a plain http endpoint', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['a loopback address', 'https://127.0.0.1/fcm/send/abc'],
    ['a private address', 'https://10.0.0.5/push'],
    ['the api on localhost', 'https://localhost:3000/push'],
    ['a host that only ends like FCM', 'https://evilfcm.googleapis.com.attacker.io/send'],
    ['a host that ends in the FCM name', 'https://notfcm.googleapis.com/send'],
    ['the bare Windows domain', 'https://notify.windows.com/w'],
    ['an endpoint over 2048 characters', `${SUBSCRIPTION.endpoint}/${'a'.repeat(2048)}`],
  ])('refuses %s', (_label, endpoint) => {
    expect(
      issuePathsOf(pushSubscriptionInputSchema.safeParse({ ...SUBSCRIPTION, endpoint })),
    ).toEqual(['endpoint']);
  });

  it.each([
    { label: 'a p256dh key over 128 characters', patch: { p256dh: 'B'.repeat(132) } },
    { label: 'an auth secret over 32 characters', patch: { auth: 'a'.repeat(34) } },
    { label: 'an auth secret outside base64url', patch: { auth: 'a+b/c=' } },
    { label: 'an empty p256dh key', patch: { p256dh: '' } },
  ])('refuses $label', ({ patch }) => {
    const keys = { ...SUBSCRIPTION.keys, ...patch };
    expect(issuePathsOf(pushSubscriptionInputSchema.safeParse({ ...SUBSCRIPTION, keys }))).toEqual(
      Object.keys(patch).map((key) => `keys.${key}`),
    );
  });
});

describe('pushPublicKeySchema', () => {
  it.each([
    ['a key', 'B'.repeat(87)],
    ['push off', null],
  ])('keeps %s', (_label, publicKey) => {
    expect(pushPublicKeySchema.parse({ publicKey })).toStrictEqual({ publicKey });
  });
});

describe('pushMessageSchema', () => {
  it('keeps a message that opens a card', () => {
    expect(pushMessageSchema.parse(MESSAGE)).toStrictEqual(MESSAGE);
  });

  it.each([
    ['an absolute url', 'https://example.com/applications'],
    ['a protocol relative url', '//example.com/applications'],
    ['a path without the leading slash', 'applications'],
  ])('refuses %s to open', (_label, url) => {
    expect(issuePathsOf(pushMessageSchema.safeParse({ ...MESSAGE, url }))).toEqual(['url']);
  });
});
