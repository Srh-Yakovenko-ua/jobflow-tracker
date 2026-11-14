import type { UserSettings } from '@jobflow/shared';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { latch } from '@/test/latch';
import type { PushRoutesOptions } from '@/test/push-browser';
import {
  installPushBrowser,
  type PushBrowserOptions,
  pushRoutes,
  SUBSCRIBED_BROWSER,
  SUBSCRIPTION_INPUT,
} from '@/test/push-browser';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { usePushSetting } from './use-push-setting';

type SettingSeed = {
  browser?: PushBrowserOptions;
  routes?: PushRoutesOptions;
  settings?: Partial<UserSettings>;
};

function renderSetting({ browser = {}, routes = {}, settings = {} }: SettingSeed = {}) {
  const fake = installPushBrowser(browser);
  const sent = pushRoutes(routes);
  server.use(...sent.handlers);
  const save = vi.fn();
  const { result } = renderHookInApp(() =>
    usePushSetting({ settings: { ...ME_RESPONSE.settings, ...settings }, save }),
  );
  return { result, save, fake, sent };
}

describe('usePushSetting', () => {
  it('rendering the setting never asks for the permission', async () => {
    const { result, fake } = renderSetting();

    await waitFor(() => {
      expect(result.current.disabled).toBe(false);
    });
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
    expect(fake.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('the switch is checked for push granted, on and subscribed in this browser', async () => {
    const { result } = renderSetting({
      browser: SUBSCRIBED_BROWSER,
      settings: { notifyPush: true },
    });

    await waitFor(() => {
      expect(result.current.checked).toBe(true);
    });
  });

  it.each([
    {
      name: 'on for another browser only',
      notifyPush: true,
      browser: { permission: 'default' },
    },
    { name: 'granted here but off', notifyPush: false, browser: SUBSCRIBED_BROWSER },
    {
      name: 'granted and on but unsubscribed here at logout',
      notifyPush: true,
      browser: { permission: 'granted', registered: true },
    },
  ] as const)('the switch stays off for push $name', async ({ notifyPush, browser }) => {
    const { result, fake } = renderSetting({ browser, settings: { notifyPush } });

    await act(() => Promise.resolve());

    expect(result.current.checked).toBe(false);
    expect(fake.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('switching on in a granted browser left without a subscription subscribes and sends it without a prompt', async () => {
    const { result, save, fake, sent } = renderSetting({
      browser: { permission: 'granted', answer: 'granted', registered: true },
      settings: { notifyPush: true },
    });

    act(() => {
      result.current.onCheckedChange(true);
    });

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith({ notifyPush: true });
    });
    expect(sent.sent).toEqual([SUBSCRIPTION_INPUT]);
    expect(fake.registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.checked).toBe(true);
    });
  });

  it('switching on asks once and saves push on only after the subscription is stored', async () => {
    const held = latch();
    const { result, save, fake, sent } = renderSetting({
      browser: { answer: 'granted' },
      routes: { subscribe: { latch: held } },
      settings: { notifyPush: false },
    });

    act(() => {
      result.current.onCheckedChange(true);
    });

    expect(fake.notification.requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(sent.sent).toHaveLength(1);
    });
    expect(save).not.toHaveBeenCalled();
    held.release();
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith({ notifyPush: true });
    });
  });

  it('switching off saves push off and leaves the browser subscribed', () => {
    const { result, save, fake } = renderSetting({ browser: SUBSCRIBED_BROWSER });

    act(() => {
      result.current.onCheckedChange(false);
    });

    expect(save).toHaveBeenCalledWith({ notifyPush: false });
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
    expect(fake.registration.state.subscription?.unsubscribe).not.toHaveBeenCalled();
  });

  it('a denied answer saves nothing', async () => {
    const { result, save, sent } = renderSetting({
      browser: { answer: 'denied' },
      settings: { notifyPush: false },
    });

    act(() => {
      result.current.onCheckedChange(true);
    });

    await waitFor(() => {
      expect(result.current.note).toBe('denied');
    });
    expect(sent.sent).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'a blocked site', seed: { browser: { permission: 'denied' } }, note: 'denied' },
    {
      name: 'a browser without push',
      seed: { browser: { supported: false } },
      note: 'unsupported',
    },
    {
      name: 'a server without VAPID keys',
      seed: { routes: { publicKey: null } },
      note: 'serverOff',
    },
  ] as const)('$name disables the switch with the $note note', async ({ seed, note }) => {
    const { result, fake } = renderSetting(seed);

    await waitFor(() => {
      expect(result.current.note).toBe(note);
    });
    expect(result.current.disabled).toBe(true);
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
  });

  it('the test button shows a local JobFlow notification leading back to these settings', async () => {
    const { result, fake } = renderSetting({
      browser: { permission: 'granted', registered: true },
    });

    act(() => {
      result.current.onTest();
    });

    await waitFor(() => {
      expect(fake.registration.showNotification).toHaveBeenCalledWith('Сповіщення працюють', {
        body: 'Так виглядатимуть нагадування JobFlow, навіть коли вкладку закрито.',
        tag: 'jobflow-test',
        icon: '/icons/jobflow-192.png',
        data: { url: '/settings#notifications' },
      });
    });
  });
});
