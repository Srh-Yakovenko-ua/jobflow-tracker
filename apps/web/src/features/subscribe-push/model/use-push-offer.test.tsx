import type { CalendarItem } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { boardQueryOptions, SILENT_ONLY } from '@/entities/application';
import { boardRoute } from '@/test/board-fixtures';
import { calendarRoute } from '@/test/calendar-fixtures';
import { flagSwitch } from '@/test/feature-flags';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { installPushBrowser, type PushBrowserOptions, pushRoutes } from '@/test/push-browser';
import { KVIT_SILENT, NEXT_INTERVIEW, REMINDER_NOW } from '@/test/reminder-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { type PushOfferActions, usePushOffer } from './use-push-offer';

vi.mock(import('@/shared/config'), async (importOriginal) => {
  const { switchableConfig } = await import('@/test/feature-flags');
  return switchableConfig(importOriginal);
});

const OFFER = {
  title: 'Увімкнути пуші в браузері?',
  silence: 'Одна з вакансій мовчить. Пуш нагадає про фоллоу-ап, навіть коли вкладку закрито.',
  interview: 'Попереду співбесіда. Пуш нагадає про неї, навіть коли вкладку закрито.',
} as const;

type OfferSeed = {
  browser?: PushBrowserOptions;
  silent?: boolean;
  interviews?: CalendarItem[];
};

function OfferHost({ actions }: Readonly<{ actions: PushOfferActions }>) {
  usePushOffer(actions);
  const shellBoard = useQuery(boardQueryOptions(SILENT_ONLY));
  return <main id="main" tabIndex={-1} data-board={shellBoard.status} />;
}

async function afterShellBoardLoads() {
  await waitFor(() => {
    expect(screen.getByRole('main').dataset.board).toBe('success');
  });
  await act(() => Promise.resolve());
}

function renderOffer({ browser = {}, silent = false, interviews = [] }: OfferSeed = {}) {
  const fake = installPushBrowser(browser);
  const push = pushRoutes();
  const calendar = calendarRoute({ items: interviews });
  const board = silent
    ? boardRoute({ counts: { applied: 1 }, cards: [KVIT_SILENT] })
    : boardRoute({ counts: {} });
  server.use(...push.handlers, calendar.handler, board.handler);
  const actions = { onEnabled: vi.fn() };
  const user = renderInApp(<OfferHost actions={actions} />);
  return { user, fake, push, calendar, board, actions };
}

pinClockInEachTest(REMINDER_NOW);

beforeEach(() => {
  flagSwitch.everyFlagOn = true;
});

afterEach(() => {
  flagSwitch.everyFlagOn = false;
  flagSwitch.overrides = {};
  toast.dismiss();
  localStorage.clear();
});

describe('usePushOffer', () => {
  it('a first visit with no silent card and no interview shows no offer and asks nothing', async () => {
    const { fake, calendar } = renderOffer();

    await waitFor(() => {
      expect(calendar.sent).toHaveLength(1);
    });
    await afterShellBoardLoads();
    expect(screen.queryByText(OFFER.title)).toBeNull();
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
  });

  it('a silent card brings the offer with the silence reason, before an interview', async () => {
    const { fake } = renderOffer({ silent: true, interviews: [NEXT_INTERVIEW] });

    expect(await screen.findByText(OFFER.silence)).toBeDefined();
    expect(screen.queryByText(OFFER.interview)).toBeNull();
    expect(fake.notification.requestPermission).not.toHaveBeenCalled();
  });

  it('an upcoming interview brings the offer when nothing is silent', async () => {
    renderOffer({ interviews: [NEXT_INTERVIEW] });

    expect(await screen.findByText(OFFER.interview)).toBeDefined();
  });

  it('«Увімкнути» asks once inside the click, subscribes, reports enabled and focuses main', async () => {
    const { user, fake, push, actions } = renderOffer({
      silent: true,
      browser: { answer: 'granted' },
    });

    await user.click(await screen.findByRole('button', { name: 'Увімкнути' }));

    expect(fake.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.getElementById('main'));
    await waitFor(() => {
      expect(actions.onEnabled).toHaveBeenCalledTimes(1);
    });
    expect(push.sent).toHaveLength(1);
    await waitFor(() => {
      expect(screen.queryByText(OFFER.title)).toBeNull();
    });
  });

  it('a denied answer shows how to unblock notifications in the browser', async () => {
    const { user, push, actions } = renderOffer({ silent: true, browser: { answer: 'denied' } });

    await user.click(await screen.findByRole('button', { name: 'Увімкнути' }));

    expect(await screen.findByText('Сповіщення заблоковані')).toBeDefined();
    expect(
      screen.getByText('Натисни значок зліва від адреси, дозволь сповіщення й онови сторінку.'),
    ).toBeDefined();
    expect(push.sent).toEqual([]);
    expect(actions.onEnabled).not.toHaveBeenCalled();
  });

  it('closing the denied steps returns focus to main', async () => {
    const { user } = renderOffer({ silent: true, browser: { answer: 'denied' } });
    await user.click(await screen.findByRole('button', { name: 'Увімкнути' }));
    await screen.findByText('Сповіщення заблоковані');

    await user.click(screen.getByRole('button', { name: 'Закрити' }));

    expect(document.activeElement).toBe(document.getElementById('main'));
  });

  it('«Не зараз» closes the offer, focuses main and keeps it away after a remount', async () => {
    const first = renderOffer({ silent: true });

    await first.user.click(await screen.findByRole('button', { name: 'Не зараз' }));

    expect(document.activeElement).toBe(document.getElementById('main'));
    await waitFor(() => {
      expect(screen.queryByText(OFFER.title)).toBeNull();
    });
    expect(first.fake.notification.requestPermission).not.toHaveBeenCalled();
    toast.dismiss();
    cleanup();

    renderOffer({ silent: true });

    await afterShellBoardLoads();
    expect(screen.queryByText(OFFER.title)).toBeNull();
  });

  it.each([
    { name: 'push already granted', seed: { browser: { permission: 'granted' } } },
    { name: 'push blocked', seed: { browser: { permission: 'denied' } } },
    { name: 'a browser without push', seed: { browser: { supported: false } } },
  ] as const)('$name shows no offer, even with a silent card', async ({ seed }) => {
    renderOffer({ ...seed, silent: true });

    await afterShellBoardLoads();
    expect(screen.queryByText(OFFER.title)).toBeNull();
  });

  it('with the browserPush flag off no offer shows and no calendar is fetched', async () => {
    flagSwitch.overrides = { browserPush: false };
    const { calendar } = renderOffer({ silent: true });

    await afterShellBoardLoads();
    expect(screen.queryByText(OFFER.title)).toBeNull();
    expect(calendar.sent).toEqual([]);
  });
});
