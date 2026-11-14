import type { PushPublicKey, PushSubscriptionCreated } from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';
import { onTestFinished, vi } from 'vitest';

import { applicationServerKeyOf } from '@/shared/lib/web-push';

import { apiUrl } from './api-handlers';
import { heldReply, type MoveRouteOptions } from './board-fixtures';
import { PUSH_PUBLIC_KEY, SUBSCRIPTION_INPUT } from './push-fixtures';

export type PushBrowserOptions = {
  permission?: NotificationPermission;
  answer?: NotificationPermission;
  subscribedWith?: Uint8Array;
  registered?: boolean;
  supported?: boolean;
};

export type PushRoutesOptions = { publicKey?: string | null; subscribe?: MoveRouteOptions };

export { PUSH_PUBLIC_KEY, SUBSCRIPTION_INPUT };

export const OLD_PUSH_KEY = new Uint8Array([4, 1, 2, 3]);

export const SUBSCRIBED_BROWSER: PushBrowserOptions = {
  permission: 'granted',
  registered: true,
  subscribedWith: applicationServerKeyOf(PUSH_PUBLIC_KEY),
};

const SUBSCRIPTION_CREATED: PushSubscriptionCreated = {
  id: '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b',
};

function fakeSubscription(key: Uint8Array) {
  return {
    endpoint: SUBSCRIPTION_INPUT.endpoint,
    options: { applicationServerKey: key.slice().buffer, userVisibleOnly: true },
    toJSON: () => ({ ...SUBSCRIPTION_INPUT, expirationTime: null }),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
}

type FakeSubscription = ReturnType<typeof fakeSubscription>;

function fakeRegistration(subscribedWith: Uint8Array | undefined) {
  const state = {
    subscription: subscribedWith && fakeSubscription(subscribedWith),
  } satisfies { subscription: FakeSubscription | undefined };
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(state.subscription ?? null)),
    subscribe: vi.fn((options: { applicationServerKey: Uint8Array }) => {
      state.subscription = fakeSubscription(options.applicationServerKey);
      return Promise.resolve(state.subscription);
    }),
  };
  return { state, pushManager, showNotification: vi.fn(() => Promise.resolve()) };
}

function fakeNotification(options: PushBrowserOptions, status: EventTarget) {
  const permission = { current: options.permission ?? 'default' };
  const notification = {
    get permission() {
      return permission.current;
    },
    requestPermission: vi.fn(() => {
      permission.current = options.answer ?? permission.current;
      return Promise.resolve(permission.current);
    }),
  };
  const setPermission = (next: NotificationPermission) => {
    permission.current = next;
    status.dispatchEvent(new Event('change'));
  };
  return { notification, setPermission };
}

function defineOnNavigator(entries: Record<string, unknown>) {
  for (const [name, value] of Object.entries(entries)) {
    Object.defineProperty(navigator, name, { value, configurable: true });
  }
  onTestFinished(() => {
    for (const name of Object.keys(entries)) Reflect.deleteProperty(navigator, name);
  });
}

export function installPushBrowser(options: PushBrowserOptions = {}) {
  const status = new EventTarget();
  const { notification, setPermission } = fakeNotification(options, status);
  const registration = fakeRegistration(options.subscribedWith);
  const registered = { current: options.registered ?? false };
  const serviceWorker = {
    getRegistration: vi.fn(() => Promise.resolve(registered.current ? registration : undefined)),
    register: vi.fn(() => {
      registered.current = true;
      return Promise.resolve(registration);
    }),
    ready: Promise.resolve(registration),
  };
  if (options.supported !== false) {
    vi.stubGlobal('Notification', notification);
    vi.stubGlobal('PushManager', {});
    defineOnNavigator({ serviceWorker, permissions: { query: () => Promise.resolve(status) } });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
  }
  return { notification, setPermission, registration, serviceWorker };
}

export function pushRoutes({
  publicKey = PUSH_PUBLIC_KEY,
  subscribe = {},
}: PushRoutesOptions = {}) {
  const sent: unknown[] = [];
  const handlers = [
    http.get(apiUrl('/push/public-key'), () => HttpResponse.json<PushPublicKey>({ publicKey })),
    http.post(apiUrl('/push/subscriptions'), async (info) => {
      sent.push(await info.request.clone().json());
      const created = () => HttpResponse.json(SUBSCRIPTION_CREATED, { status: 201 });
      return heldReply({ ...subscribe, info, fallback: created });
    }),
  ];
  return { handlers, sent };
}
