import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { REFUSED_CONNECTION } from '@/test/api-handlers';
import { push } from '@/test/navigation';
import {
  NOTIFICATION_NOW,
  notificationRoutes,
  type NotificationRoutesOptions,
  SILENCE_NOTIFICATION,
  SILENT_LONGEST_ID,
  unreadMeRoute,
} from '@/test/notification-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { NotificationBell } from './notification-bell';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const COPY = uk.notifications;

const RETRIED_ERROR_MS = 2500;

pinClockInEachTest(NOTIFICATION_NOW);

function renderBell({
  unread = 3,
  ...routes
}: NotificationRoutesOptions & { unread?: number } = {}) {
  const feed = notificationRoutes(routes);
  server.use(unreadMeRoute(unread), ...feed.handlers);
  const user = renderInApp(<NotificationBell />);
  return { user, sent: feed.sent };
}

async function openBell(options: Parameters<typeof renderBell>[0] = {}) {
  const rendered = renderBell(options);
  await rendered.user.click(await screen.findByRole('button', { name: /^Сповіщення, / }));
  const popover = await screen.findByRole('dialog', { name: COPY.title });
  return { ...rendered, popover };
}

describe('NotificationBell', () => {
  it.each([
    { unread: 3, name: 'Сповіщення, 3 непрочитані', badge: '3' },
    { unread: 120, name: 'Сповіщення, 120 непрочитаних', badge: '99+' },
  ])(
    'names $unread unread in its label and shows $badge on the badge',
    async ({ unread, name, badge }) => {
      renderBell({ unread });

      const bell = await screen.findByRole('button', { name });

      expect(bell.textContent).toBe(badge);
    },
  );

  it('shows no badge with nothing unread and asks for no list while closed', async () => {
    const { sent } = renderBell({ unread: 0 });

    const bell = await screen.findByRole('button', { name: COPY.title });

    expect(bell.textContent).toBe('');
    expect(sent.lists).toEqual([]);
  });

  it('opens the latest 20 grouped by the Kyiv day under the drawn header', async () => {
    const { popover, sent } = await openBell();

    expect(await within(popover).findByRole('heading', { name: 'Сьогодні' })).toBeDefined();
    expect(within(popover).getByRole('heading', { name: 'Вчора' })).toBeDefined();
    expect(within(popover).getByText('нагадування · 3')).toBeDefined();
    expect(within(popover).getByText('2 картки в тиші')).toBeDefined();
    expect(within(popover).getByText('Acme, Kvit Software · 14 днів без відповіді')).toBeDefined();
    expect(within(popover).getByText('Співбесіда о 16:00')).toBeDefined();
    expect(sent.lists.map((search) => search.toString())).toEqual(['limit=20']);
  });

  it('a silence row leads to the follow-up block of the longest silent card in one click and marks it read', async () => {
    const { user, popover, sent } = await openBell({ unreadAfterRead: 2 });
    const followUp = await within(popover).findByRole('link', { name: COPY.silence.action });

    expect(followUp.getAttribute('href')).toBe(`/applications/${SILENT_LONGEST_ID}#follow-up`);
    await user.click(followUp);

    expect(push).toHaveBeenLastCalledWith(`/applications/${SILENT_LONGEST_ID}#follow-up`);
    await vi.waitFor(() => {
      expect(sent.reads).toEqual([{ ids: [SILENCE_NOTIFICATION.id] }]);
    });
    expect(await screen.findByRole('button', { name: 'Сповіщення, 2 непрочитані' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Прочитати все marks every row read and the badge goes away', async () => {
    const { user, popover, sent } = await openBell();

    await user.click(within(popover).getByRole('button', { name: COPY.readAll }));

    expect(await screen.findByRole('button', { name: COPY.title })).toBeDefined();
    expect(sent.reads).toEqual([{ all: true }]);
  });

  it('with no rows says everyone answered', async () => {
    const { popover } = await openBell({ feed: { items: [], nextCursor: null } });

    expect(await within(popover).findByText(COPY.popoverEmpty)).toBeDefined();
    expect(within(popover).getByRole('link', { name: COPY.all }).getAttribute('href')).toBe(
      '/notifications',
    );
  });

  it('a failed list offers a retry inside the popover', async () => {
    const { popover } = await openBell({ listReply: REFUSED_CONNECTION.reply });

    expect(
      await within(popover).findByRole(
        'button',
        { name: uk.states.errors.loadFailed.action },
        { timeout: RETRIED_ERROR_MS },
      ),
    ).toBeDefined();
  });
});
