import { screen, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { boardRoute, type ColumnCounts } from '@/test/board-fixtures';
import {
  calendarRoute,
  type CalendarRouteOptions,
  FOLLOWUP_ITEM,
  KYIV_WEEK,
  scheduledItemOf,
} from '@/test/calendar-fixtures';
import { stubMediaQuery } from '@/test/media-query';
import { push } from '@/test/navigation';
import { renderInApp } from '@/test/render-in-app';
import { pinScheduleClock } from '@/test/schedule-dialog';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { CalendarPage } from './calendar-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const flags = vi.hoisted(() => ({ reminders: false }));

vi.mock(import('@/shared/config'), async (importOriginal) => {
  const actual = await importOriginal();
  const FEATURE_FLAGS = {
    ...actual.FEATURE_FLAGS,
    get reminders() {
      return flags.reminders;
    },
  };
  return { ...actual, FEATURE_FLAGS };
});

const INTERVIEW = scheduledItemOf({
  serial: 611,
  kind: 'tech_interview',
  start: '2026-11-04T09:00:00.000Z',
});

const EMPTY_WEEK = 'Цього тижня співбесід немає';

const NEXT_KYIV_WEEK = { from: '2026-11-08T22:00:00.000Z', to: '2026-11-15T22:00:00.000Z' };

const TRANSIENT_RETRY_MS = 3000;

type CalendarSetup = CalendarRouteOptions & {
  narrow?: boolean;
  silent?: ColumnCounts;
  timezone?: string;
};

function renderCalendar({
  narrow = false,
  silent = {},
  timezone = 'Europe/Kyiv',
  ...route
}: CalendarSetup = {}) {
  stubMediaQuery({ query: '(width < 48rem)', matches: narrow });
  const calendar = calendarRoute(route);
  server.use(meRoute({ timezone }), calendar.handler, boardRoute({ counts: silent }).handler);
  const user = renderInApp(<CalendarPage />);
  return { user, sent: calendar.sent };
}

function viewRadio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

async function waitForAsked(range: { from: string; to: string }, sent: readonly object[]) {
  await waitFor(() => {
    expect(sent.at(-1)).toEqual(range);
  });
}

beforeEach(() => {
  pinScheduleClock();
  flags.reminders = false;
});

afterEach(() => {
  vi.useRealTimers();
  push.mockClear();
});

describe('CalendarPage', () => {
  it('opens on the Kyiv week in the week grid at desktop width and asks for it in UTC', async () => {
    const { sent } = renderCalendar();

    await waitForAsked(KYIV_WEEK, sent);
    expect(viewRadio('Тиждень').getAttribute('aria-checked')).toBe('true');
  });

  it('lays the week out in the zone from the settings, not the browser one', async () => {
    const { sent } = renderCalendar({
      items: [INTERVIEW],
      narrow: true,
      timezone: 'America/New_York',
    });

    await waitForAsked({ from: '2026-11-02T05:00:00.000Z', to: '2026-11-09T05:00:00.000Z' }, sent);
    const pill = (await screen.findByText(INTERVIEW.title)).parentElement;
    expect(pill?.textContent).toContain('04:00');
  });

  it('opens on the agenda list under 48rem', async () => {
    const { sent } = renderCalendar({ narrow: true });

    await waitForAsked(KYIV_WEEK, sent);
    expect(viewRadio('Список').getAttribute('aria-checked')).toBe('true');
  });

  it('moves to the next week and to the whole month from the toolbar', async () => {
    const { user, sent } = renderCalendar();
    await waitForAsked(KYIV_WEEK, sent);

    await user.click(screen.getByRole('button', { name: 'Наступний період' }));
    await waitForAsked(NEXT_KYIV_WEEK, sent);
    await user.click(screen.getByRole('button', { name: 'Сьогодні' }));
    await user.click(viewRadio('Місяць'));

    await waitForAsked({ from: '2026-10-25T22:00:00.000Z', to: '2026-12-06T22:00:00.000Z' }, sent);
  });

  it.each([
    { kind: 'screening_call', icon: 'phone-call' },
    { kind: 'tech_interview', icon: 'calendar-clock' },
    { kind: 'final_interview', icon: 'calendar-clock' },
    { kind: 'offer_call', icon: 'phone-call' },
    { kind: 'other', icon: 'calendar-clock' },
  ] as const)(
    'shows a $kind with the $icon icon, its Kyiv time and its title',
    async ({ kind, icon }) => {
      const item = scheduledItemOf({ serial: 612, kind, start: '2026-11-04T09:00:00.000Z' });
      renderCalendar({ items: [item], narrow: true });

      const pill = (await screen.findByText(item.title)).parentElement;

      expect(pill?.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
      expect(pill?.textContent).toContain('11:00');
    },
  );

  it('shows a follow-up with the alarm icon', async () => {
    renderCalendar({ items: [FOLLOWUP_ITEM], narrow: true });

    const pill = (await screen.findByText(FOLLOWUP_ITEM.title)).parentElement;

    expect(pill?.querySelector('svg.lucide-alarm-clock')).not.toBeNull();
  });

  it('opens the vacancy card of a clicked event', async () => {
    const { user } = renderCalendar({ items: [INTERVIEW], narrow: true });

    await user.click(await screen.findByText(INTERVIEW.title));

    expect(push).toHaveBeenCalledWith(`/applications/${ACME_APPLICATION.id}`);
  });

  it('opens the vacancy card of an event reached with the keyboard', async () => {
    const { user } = renderCalendar({ items: [INTERVIEW], narrow: true });
    const event = (await screen.findByText(INTERVIEW.title)).closest<HTMLElement>('[tabindex]');

    event?.focus();
    await user.keyboard('{Enter}');

    expect(push).toHaveBeenCalledWith(`/applications/${ACME_APPLICATION.id}`);
  });

  it('with no interview this week, counts the silent cards and links to them on the board', async () => {
    renderCalendar({ items: [FOLLOWUP_ITEM], silent: { applied: 2, screening: 1 } });

    expect(await screen.findByText(EMPTY_WEEK)).toBeDefined();
    expect(await screen.findByText('3 тихі картки')).toBeDefined();
    const link = screen.getByRole('link', { name: 'Показати тихі картки' });
    expect(link.getAttribute('href')).toBe('/board?silence=silent');
  });

  it('with reminders shipped, the empty week links to the reminders', async () => {
    flags.reminders = true;
    renderCalendar({ silent: { applied: 1 } });

    expect(await screen.findByText(EMPTY_WEEK)).toBeDefined();
    const link = screen.getByRole('link', { name: 'До нагадувань' });
    expect(link.getAttribute('href')).toBe('/reminders');
  });

  it('on another week with no interview, does not call it this week', async () => {
    const { user, sent } = renderCalendar();
    await waitForAsked(KYIV_WEEK, sent);
    expect(await screen.findByText(EMPTY_WEEK)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Наступний період' }));
    await waitForAsked(NEXT_KYIV_WEEK, sent);

    expect(await screen.findByText('На вибраному тижні співбесід немає')).toBeDefined();
    expect(screen.queryByText(EMPTY_WEEK)).toBeNull();
  });

  it('an empty agenda says it is empty once, not twice', async () => {
    renderCalendar({ narrow: true });

    expect(await screen.findByText(EMPTY_WEEK)).toBeDefined();
    expect(screen.queryByText(/подій/i)).toBeNull();
  });

  it('keeps one interview per hour on the week grid and folds the others into one more link', async () => {
    const crowded = ['13:00', '13:00', '13:30'].map((time, index) =>
      scheduledItemOf({
        serial: 620 + index,
        kind: 'tech_interview',
        start: `2026-11-06T${time}:00.000Z`,
      }),
    );
    renderCalendar({ items: crowded });

    expect(await screen.findAllByText(INTERVIEW.title)).toHaveLength(1);
    expect(screen.getByTitle('ще 2').textContent).toBe('+2');
  });

  it('names the timed rows of the week grid in Ukrainian for a screen reader', async () => {
    const { sent } = renderCalendar();
    await waitForAsked(KYIV_WEEK, sent);

    expect(screen.queryByText('Timed')).toBeNull();
    expect(screen.getAllByText('за годинами').length).toBeGreaterThan(0);
  });

  it('says nothing about an empty week once an interview is in it', async () => {
    renderCalendar({ items: [INTERVIEW] });

    expect(await screen.findByText(INTERVIEW.title)).toBeDefined();
    expect(screen.queryByText(EMPTY_WEEK)).toBeNull();
  });

  it('a failed load offers a retry that brings the events in', async () => {
    let down = true;
    const { user } = renderCalendar({
      narrow: true,
      reply: () =>
        down
          ? errorReply({ status: 500, type: 'internal_error' })
          : HttpResponse.json({ items: [INTERVIEW] }),
    });

    const retry = await screen.findByRole(
      'button',
      { name: 'Спробувати ще раз' },
      { timeout: TRANSIENT_RETRY_MS },
    );
    down = false;
    await user.click(retry);

    expect(await screen.findByText(INTERVIEW.title)).toBeDefined();
  });
});
