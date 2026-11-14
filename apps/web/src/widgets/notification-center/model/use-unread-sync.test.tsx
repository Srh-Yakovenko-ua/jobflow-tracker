import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { notificationRoutes, unreadMeRoute } from '@/test/notification-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { NotificationBell } from '../ui/notification-bell';
import { UNREAD_CHANNEL } from './unread-cache';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const COPY = uk.notifications;

async function twoTabs(unreadAfterRead: number) {
  server.use(unreadMeRoute(3), ...notificationRoutes({ unreadAfterRead }).handlers);
  const first = renderViewInApp(<NotificationBell />);
  const second = renderViewInApp(<NotificationBell />);
  const badgeIn = (tab: typeof first, name: string) =>
    within(tab.view.container).findByRole('button', { name });
  await badgeIn(first, 'Сповіщення, 3 непрочитані');
  await badgeIn(second, 'Сповіщення, 3 непрочитані');
  await first.user.click(within(first.view.container).getByRole('button'));
  const popover = await screen.findByRole('dialog', { name: COPY.title });
  return { first, popover, secondBadge: (name: string) => badgeIn(second, name) };
}

function heardOn(channelName: string) {
  const probe = new BroadcastChannel(channelName);
  const heard: unknown[] = [];
  probe.onmessage = (event: MessageEvent<unknown>) => {
    heard.push(event.data);
  };
  return {
    heard,
    close: () => {
      probe.close();
    },
  };
}

describe('useUnreadSync', () => {
  it('Прочитати все in one tab takes the badge off the other tab', async () => {
    const { first, popover, secondBadge } = await twoTabs(0);

    await first.user.click(within(popover).getByRole('button', { name: COPY.readAll }));

    expect(await secondBadge(COPY.title)).toBeDefined();
  });

  it('reading one row in one tab shows the count the server returned in the other tab', async () => {
    const { first, popover, secondBadge } = await twoTabs(2);
    const row = await within(popover).findByRole('link', { name: COPY.silence.action });

    await first.user.click(row);

    expect(await secondBadge('Сповіщення, 2 непрочитані')).toBeDefined();
  });

  it('a malformed message on the channel leaves the count alone', async () => {
    server.use(unreadMeRoute(3), ...notificationRoutes().handlers);
    const tab = renderViewInApp(<NotificationBell />);
    const bell = await within(tab.view.container).findByRole('button', {
      name: 'Сповіщення, 3 непрочитані',
    });
    const probe = heardOn(UNREAD_CHANNEL);
    const sender = new BroadcastChannel(UNREAD_CHANNEL);

    sender.postMessage({ unread: -1 });
    sender.postMessage('all read');
    await waitFor(() => {
      expect(probe.heard).toHaveLength(2);
    });
    sender.close();
    probe.close();

    expect(bell.getAttribute('aria-label')).toBe('Сповіщення, 3 непрочитані');
  });
});
