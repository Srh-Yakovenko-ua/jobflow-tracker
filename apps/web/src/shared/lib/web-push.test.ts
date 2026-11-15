import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { installPushBrowser, OLD_PUSH_KEY } from '@/test/push-browser';

import { logger } from './logger';
import { dropPushSubscription, pushSupported } from './push-subscription';
import { applicationServerKeyOf, pushRegistration, usePushPermission } from './web-push';

describe('web push in the browser', () => {
  it('a base64url VAPID key becomes the bytes it encodes, padding restored', () => {
    expect(Array.from(applicationServerKeyOf('BAEC-_8'))).toEqual([4, 1, 2, 251, 255]);
  });

  it('a browser without the Push API counts as unsupported', () => {
    expect(pushSupported()).toBe(false);
    installPushBrowser();
    expect(pushSupported()).toBe(true);
  });

  it('the first enable registers sw.js for the whole site without the HTTP cache', async () => {
    const browser = installPushBrowser();

    expect(await pushRegistration()).toBe(browser.registration);
    expect(browser.serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });

  it('a worker already registered is reused, not registered again', async () => {
    const browser = installPushBrowser({ registered: true });

    expect(await pushRegistration()).toBe(browser.registration);
    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
  });

  it('logout unbinds this browser from its push subscription', async () => {
    const browser = installPushBrowser({ registered: true, subscribedWith: OLD_PUSH_KEY });
    const subscription = browser.registration.state.subscription;

    await dropPushSubscription();

    expect(subscription?.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('a failed unbind is logged and never reaches logout', async () => {
    const browser = installPushBrowser({ registered: true });
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    browser.registration.pushManager.getSubscription.mockRejectedValueOnce(
      new DOMException('Push service gone', 'AbortError'),
    );

    await expect(dropPushSubscription()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('the permission reads unsupported without the Push API', () => {
    const { result } = renderHook(() => usePushPermission());

    expect(result.current).toBe('unsupported');
  });

  it('the permission follows a change made in the browser site settings', async () => {
    const browser = installPushBrowser({ permission: 'denied' });
    const { result } = renderHook(() => usePushPermission());
    expect(result.current).toBe('denied');

    const grant = () => {
      browser.setPermission('granted');
    };
    await waitFor(() => {
      act(grant);
      expect(result.current).toBe('granted');
    });
  });
});
