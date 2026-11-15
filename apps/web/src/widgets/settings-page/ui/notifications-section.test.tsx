import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  installPushBrowser,
  type PushBrowserOptions,
  pushRoutes,
  SUBSCRIBED_BROWSER,
} from '@/test/push-browser';
import { regionOf, renderLoadedSettings } from '@/test/render-settings-page';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const notifications = () => within(regionOf('Повідомлення'));

const pushSwitch = () => notifications().getByRole('switch', { name: /Пуші в браузері/ });

const TEST_BUTTON = { name: 'Надіслати тестове сповіщення' } as const;

type PushSeed = { browser: PushBrowserOptions; notifyPush: boolean };

async function renderWithPush({ browser, notifyPush }: PushSeed) {
  const fake = installPushBrowser(browser);
  server.use(...pushRoutes().handlers);
  const page = await renderLoadedSettings({ settings: { notifyPush } });
  return { ...page, fake };
}

describe('NotificationsSection, browser push', () => {
  it('a browser without push shows the switch disabled with a note', async () => {
    await renderLoadedSettings();

    expect(pushSwitch().hasAttribute('disabled')).toBe(true);
    expect(
      notifications().getByText('Цей браузер не вміє показувати пуші. Спробуй Chrome або Firefox.'),
    ).toBeDefined();
    expect(notifications().queryByRole('button', TEST_BUTTON)).toBeNull();
  });

  it('a blocked site shows how to unblock it and never asks for the permission', async () => {
    const { user, fake } = await renderWithPush({
      browser: { permission: 'denied' },
      notifyPush: false,
    });

    const note = await notifications().findByText(/Сповіщення для цього сайту заблоковані/);
    await user.click(pushSwitch());

    expect(note.textContent).toBe(
      'Сповіщення для цього сайту заблоковані в браузері. Натисни значок зліва від адреси сайту, дозволь сповіщення й онови сторінку.',
    );
    expect(pushSwitch().getAttribute('aria-describedby')).toBe(note.id);
    expect(pushSwitch().hasAttribute('disabled')).toBe(true);
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
  });

  it('with push on and granted the test button shows a local JobFlow notification', async () => {
    const { user, fake } = await renderWithPush({ browser: SUBSCRIBED_BROWSER, notifyPush: true });

    await user.click(await notifications().findByRole('button', TEST_BUTTON));
    expect(pushSwitch().getAttribute('aria-checked')).toBe('true');

    await waitFor(() => {
      expect(fake.registration.showNotification).toHaveBeenCalledWith(
        'Сповіщення працюють',
        expect.objectContaining({ tag: 'jobflow-test' }),
      );
    });
  });

  it('switching push off saves only that field and hides the test button', async () => {
    const { user, routes, fake } = await renderWithPush({
      browser: SUBSCRIBED_BROWSER,
      notifyPush: true,
    });
    expect(await notifications().findByRole('button', TEST_BUTTON)).toBeDefined();

    await user.click(pushSwitch());

    await waitFor(() => {
      expect(routes.patches).toEqual([{ notifyPush: false }]);
    });
    await waitFor(() => {
      expect(notifications().queryByRole('button', TEST_BUTTON)).toBeNull();
    });
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
  });
});

describe('NotificationsSection', () => {
  it('the in-app switch saves only its own field', async () => {
    const { user, routes } = await renderLoadedSettings();

    await user.click(notifications().getByRole('switch', { name: /Сповіщення в застосунку/ }));

    await waitFor(() => {
      expect(routes.patches).toEqual([{ notifyInApp: true }]);
    });
    expect(notifications().getByRole('status').textContent).toBe('Збережено');
  });

  it('a quiet hour is saved on leaving the field, and only when it changed', async () => {
    const { user, routes } = await renderLoadedSettings();
    const start = notifications().getByLabelText('Від');
    const end = notifications().getByLabelText('До');

    await user.click(end);
    await user.tab();
    await user.clear(start);
    await user.type(start, '22:15');
    await user.tab();

    await waitFor(() => {
      expect(routes.patches).toEqual([{ quietHoursStart: '22:15' }]);
    });
    expect(start).toHaveProperty('value', '22:15');
  });

  it('a cleared quiet hour is not saved and shows the stored time again', async () => {
    const { user, routes } = await renderLoadedSettings();
    const start = notifications().getByLabelText('Від');

    await user.clear(start);
    await user.tab();

    expect(start).toHaveProperty('value', '21:30');
    expect(routes.patches).toEqual([]);
  });

  it('the time zone is picked from a searchable list and cannot be cleared', async () => {
    const { user, routes } = await renderLoadedSettings();
    const timeZone = notifications().getByRole('combobox', { name: 'Часовий пояс' });

    expect(timeZone.textContent).toBe('Europe/Kyiv');
    expect(notifications().queryByRole('button', { name: 'Скинути' })).toBeNull();
    await user.click(timeZone);
    await user.type(await screen.findByPlaceholderText('Пошук поясу'), 'Tokyo');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(routes.patches).toEqual([{ timezone: 'Asia/Tokyo' }]);
    });
    expect(timeZone.textContent).toBe('Asia/Tokyo');
  });
});
