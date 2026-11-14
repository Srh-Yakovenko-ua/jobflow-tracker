import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applicationServerKeyOf } from '@/shared/lib/web-push';
import { apiUrl, errorReply } from '@/test/api-handlers';
import {
  installPushBrowser,
  OLD_PUSH_KEY,
  PUSH_PUBLIC_KEY,
  pushRoutes,
  SUBSCRIPTION_INPUT,
} from '@/test/push-browser';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useEnablePush } from './use-enable-push';

const PUSH_KEY_BYTES = applicationServerKeyOf(PUSH_PUBLIC_KEY);

function renderEnable(browser = installPushBrowser()) {
  const routes = pushRoutes();
  server.use(...routes.handlers);
  const actions = { onEnabled: vi.fn(), onDenied: vi.fn() };
  const { result } = renderHookInApp(() => useEnablePush(actions));
  const answer = (permission: NotificationPermission) => {
    act(() => {
      result.current.enable(Promise.resolve(permission));
    });
  };
  return { browser, routes, actions, answer };
}

afterEach(() => {
  toast.dismiss();
});

describe('useEnablePush', () => {
  it('a granted answer subscribes with the server key, sends the subscription and only then reports enabled', async () => {
    const { browser, routes, actions, answer } = renderEnable();

    answer('granted');

    await waitFor(() => {
      expect(actions.onEnabled).toHaveBeenCalledTimes(1);
    });
    expect(browser.notification.requestPermission).not.toHaveBeenCalled();
    expect(browser.serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(browser.registration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: PUSH_KEY_BYTES,
    });
    expect(routes.sent).toEqual([SUBSCRIPTION_INPUT]);
    expect(actions.onDenied).not.toHaveBeenCalled();
  });

  it.each(['denied', 'default'] as const)(
    'a %s answer sends nothing and reports nothing enabled',
    async (permission) => {
      const { browser, routes, actions, answer } = renderEnable();

      answer(permission);

      await waitFor(() => {
        expect(actions.onDenied).toHaveBeenCalledTimes(permission === 'denied' ? 1 : 0);
      });
      await act(() => Promise.resolve());
      expect(browser.serviceWorker.register).not.toHaveBeenCalled();
      expect(routes.sent).toEqual([]);
      expect(actions.onEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: 'an old server key is replaced', key: OLD_PUSH_KEY, replaced: 1 },
    { name: 'the current key is sent again as it is', key: PUSH_KEY_BYTES, replaced: 0 },
  ])('a subscription made with $name', async ({ key, replaced }) => {
    const browser = installPushBrowser({ registered: true, subscribedWith: key });
    const existing = browser.registration.state.subscription;
    const { routes, actions, answer } = renderEnable(browser);

    answer('granted');

    await waitFor(() => {
      expect(actions.onEnabled).toHaveBeenCalledTimes(1);
    });
    expect(existing?.unsubscribe).toHaveBeenCalledTimes(replaced);
    expect(browser.registration.pushManager.subscribe).toHaveBeenCalledTimes(replaced);
    expect(routes.sent).toEqual([SUBSCRIPTION_INPUT]);
  });

  it('a refused save says push did not turn on and reports nothing enabled', async () => {
    const { actions, answer } = renderEnable();
    server.use(
      http.post(apiUrl('/push/subscriptions'), () =>
        errorReply({ status: 500, type: 'internal_error' }),
      ),
    );

    answer('granted');

    expect(await screen.findByText('Не вдалося увімкнути пуші')).toBeDefined();
    expect(actions.onEnabled).not.toHaveBeenCalled();
  });
});
