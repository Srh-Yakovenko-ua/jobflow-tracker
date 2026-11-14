import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { NEVER_ANSWERS, REFUSED_CONNECTION } from '@/test/api-handlers';
import { boardRoute } from '@/test/board-fixtures';
import {
  buildNotification,
  DESIGN_FEED,
  MONTHLY_SUMMARY_NOTIFICATION,
  NOTIFICATION_NOW,
  notificationIdOf,
  notificationRoutes,
  type NotificationRoutesOptions,
  unreadMeRoute,
} from '@/test/notification-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { findRetryAfterQueryRetries } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { NotificationsPage } from './notifications-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const COPY = uk.notifications;

const OLDER = buildNotification({
  serial: 40,
  type: 'insight_unlocked',
  createdAt: '2026-11-02T09:00:00.000Z',
  readAt: '2026-11-02T10:00:00.000Z',
  payload: { applications: 10 },
});

const NO_TARGET = buildNotification({
  serial: 41,
  type: 'ai_failed',
  payload: { aiJobId: notificationIdOf(42), kind: 'vacancy_parse', errorType: 'ai_timeout' },
});

pinClockInEachTest(NOTIFICATION_NOW);

function renderPage(routes: NotificationRoutesOptions = {}) {
  const feed = notificationRoutes(routes);
  server.use(unreadMeRoute(2), boardRoute({ counts: {} }).handler, ...feed.handlers);
  const user = renderInApp(<NotificationsPage />);
  return { user, sent: feed.sent };
}

function listsSent(sent: { lists: URLSearchParams[] }) {
  return sent.lists.map((search) => search.toString());
}

describe('NotificationsPage', () => {
  it('lists every notification by day and Непрочитані asks the API for unread ones only', async () => {
    const { user, sent } = renderPage();
    expect(await screen.findByRole('heading', { name: 'Вчора' })).toBeDefined();

    await user.click(screen.getByRole('radio', { name: COPY.filters.options.unread }));

    await waitFor(() => {
      expect(listsSent(sent)).toEqual(['limit=50', 'limit=50&unread=true']);
    });
    expect(await screen.findByText('Співбесіда о 16:00')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Вчора' })).toBeNull();
  });

  it('titles the page with its own h1, since the shell has no nav title for /notifications', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Вчора' });

    expect(screen.getByRole('heading', { level: 1, name: COPY.title })).toBeDefined();
  });

  it('day headings sit one level below the page h1, at h2', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Сьогодні' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Вчора' })).toBeDefined();
  });

  it('an unread notification that leads nowhere can be marked read on its own', async () => {
    const { user } = renderPage({ feed: { items: [NO_TARGET], nextCursor: null } });
    const markRead = await screen.findByRole('button', { name: COPY.markRead });
    const read = { ...NO_TARGET, readAt: NOTIFICATION_NOW.toISOString() };
    const afterRead = notificationRoutes({ feed: { items: [read], nextCursor: null } });
    server.use(...afterRead.handlers);

    await user.click(markRead);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: COPY.markRead })).toBeNull();
    });
    expect(afterRead.sent.reads).toEqual([{ ids: [NO_TARGET.id] }]);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('Показати ще asks for the page after the cursor and adds its rows', async () => {
    const cursor = notificationIdOf(3);
    const { user, sent } = renderPage({
      feed: { ...DESIGN_FEED, nextCursor: cursor },
      more: { items: [OLDER], nextCursor: null },
    });

    await user.click(await screen.findByRole('button', { name: COPY.more }));

    expect(await screen.findByRole('heading', { name: '02.11' })).toBeDefined();
    expect(listsSent(sent)).toEqual(['limit=50', `limit=50&cursor=${cursor}`]);
    expect(screen.queryByRole('button', { name: COPY.more })).toBeNull();
  });

  it('Прочитати все marks every notification read', async () => {
    const { user, sent } = renderPage();
    await screen.findByRole('heading', { name: 'Сьогодні' });

    await user.click(screen.getByRole('button', { name: COPY.readAll }));

    await waitFor(() => {
      expect(sent.reads).toEqual([{ all: true }]);
    });
  });

  it('a ready monthly summary names its month and leads to the analytics', async () => {
    renderPage({ feed: { items: [MONTHLY_SUMMARY_NOTIFICATION], nextCursor: null } });

    expect(await screen.findByText('Саммарі за жовтень готове')).toBeDefined();
    expect(screen.getByText(COPY.monthlySummaryReady.text)).toBeDefined();
    const open = screen.getByRole('link', { name: COPY.monthlySummaryReady.action });
    expect(open.getAttribute('href')).toBe('/analytics/summary/2026-10');
  });

  it('shows the loading state while the first page is on its way', async () => {
    renderPage({ listReply: NEVER_ANSWERS.reply });

    expect(await screen.findByRole('status')).toHaveProperty('textContent', uk.ui.loading);
  });

  it('a failed first page offers a retry that loads it', async () => {
    const { user } = renderPage({ listReply: REFUSED_CONNECTION.reply });
    const retry = await findRetryAfterQueryRetries();
    server.use(...notificationRoutes().handlers);

    await user.click(retry);

    expect(await screen.findByRole('heading', { name: 'Сьогодні' })).toBeDefined();
  });

  it('with nothing to show says everyone answered, with the user threshold and the silent count', async () => {
    renderPage({ feed: { items: [], nextCursor: null } });

    expect(await screen.findByRole('heading', { name: COPY.empty.title })).toBeDefined();
    expect(
      await screen.findByText(
        'Жодної картки без подій довше 12 днів. Саме такий вигляд цього екрана найкращий.',
      ),
    ).toBeDefined();
    expect(await screen.findByText('0 карток у тиші')).toBeDefined();
  });
});
