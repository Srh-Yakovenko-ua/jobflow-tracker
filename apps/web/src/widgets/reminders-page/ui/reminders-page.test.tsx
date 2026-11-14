import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { apiUrl, errorReply, REFUSED_CONNECTION } from '@/test/api-handlers';
import { boardRoute, moveRoute } from '@/test/board-fixtures';
import { calendarRoute } from '@/test/calendar-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { findRetryAfterQueryRetries } from '@/test/query-status';
import {
  ACME_SILENT,
  KVIT_SILENT,
  NEXT_INTERVIEW,
  REMINDER_LIST,
  REMINDER_NOW,
  reminderIdOf,
  type RemindersRouteOptions,
  remindersRoutes,
  SILENT_CARDS,
} from '@/test/reminder-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { RemindersPage } from './reminders-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const COPY = uk.reminders;

type PageRoutes = RemindersRouteOptions & {
  cards?: typeof SILENT_CARDS;
  interviews?: (typeof NEXT_INTERVIEW)[];
};

const unhandled: string[] = [];

pinClockInEachTest(REMINDER_NOW);

afterEach(() => {
  toast.dismiss();
  expect(unhandled.splice(0)).toEqual([]);
});

function renderPage({
  cards = SILENT_CARDS,
  interviews = [NEXT_INTERVIEW],
  ...routes
}: PageRoutes = {}) {
  const reminders = remindersRoutes(routes);
  const calendar = calendarRoute({ items: interviews });
  const moves = moveRoute();
  server.use(
    http.all(apiUrl('/*'), ({ request }) => {
      unhandled.push(`${request.method} ${request.url}`);
      return errorReply({ status: 501, type: 'not_implemented' });
    }),
  );
  server.use(
    meRoute(),
    boardRoute({ counts: {}, cards }).handler,
    calendar.handler,
    moves.handler,
    ...reminders.handlers,
  );
  const user = renderInApp(<RemindersPage />);
  return { user, sent: { ...reminders.sent, calendar: calendar.sent, moves: moves.sent } };
}

function rowOf(company: string) {
  return within(screen.getByRole('article', { name: company }));
}

async function silentCompanies() {
  await screen.findAllByRole('article');
  return screen.getAllByRole('article').map((row) => within(row).getByRole('heading').textContent);
}

describe('RemindersPage', () => {
  it('lists the silent cards, the longest silence first, each with its stage and days', async () => {
    renderPage();

    expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme', 'Kvit Software']);
    const acme = rowOf('Acme');
    expect(acme.getByText('Vacancy 801 · скринінг')).toBeDefined();
    expect(acme.getByText('14 днів тиші')).toBeDefined();
    expect(acme.getByRole('link', { name: COPY.actions.followUp }).getAttribute('href')).toBe(
      `/applications/${ACME_SILENT.id}#follow-up`,
    );
  });

  it('leaves the one h1 to the app shell and titles the page with a second-level heading', async () => {
    renderPage();
    await silentCompanies();

    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: COPY.title })).toBeDefined();
  });

  it('a card the silence scan has not reached yet has no snooze, only the other two actions', async () => {
    renderPage();
    await silentCompanies();

    const zoria = rowOf('Zoria Tech');
    expect(zoria.queryByRole('button', { name: COPY.actions.snooze })).toBeNull();
    expect(zoria.getByRole('button', { name: COPY.actions.reply })).toBeDefined();
    expect(rowOf('Acme').getByRole('button', { name: COPY.actions.snooze })).toBeDefined();
  });

  it('Почекати ще, 3 дні posts the snooze, the row leaves and focus lands on the section', async () => {
    const { user, sent } = renderPage();
    await silentCompanies();

    await user.click(rowOf('Kvit Software').getByRole('button', { name: COPY.actions.snooze }));
    await user.click(await screen.findByRole('menuitem', { name: '3 дні' }));

    await waitFor(() => {
      expect(sent.snoozes).toEqual([{ id: reminderIdOf(KVIT_SILENT), body: { days: 3 } }]);
    });
    await waitFor(async () => {
      expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme']);
    });
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: COPY.silence.title }));
  });

  it('a snooze that has run out brings its row back, one still running keeps it hidden', async () => {
    renderPage({ items: REMINDER_LIST.items });

    expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme']);
  });

  it('a 409 on the snooze puts the row back and says the snooze failed', async () => {
    const { user } = renderPage({
      snoozeReply: () => errorReply({ status: 409, type: 'conflict' }),
    });
    await silentCompanies();

    await user.click(rowOf('Acme').getByRole('button', { name: COPY.actions.snooze }));
    await user.click(await screen.findByRole('menuitem', { name: '7 днів' }));

    expect(await screen.findByText(COPY.snoozeFailed.title)).toBeDefined();
    expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme', 'Kvit Software']);
  });

  it('Відповідь є offers the legal moves without ghosted and sends the chosen one', async () => {
    const { user, sent } = renderPage();
    await silentCompanies();

    await user.click(rowOf('Kvit Software').getByRole('button', { name: COPY.actions.reply }));

    const moves = await screen.findAllByRole('menuitem');
    expect(moves.map((move) => move.textContent)).toEqual([
      'скринінг',
      "техінтерв'ю",
      'відмова',
      'відкликав',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'скринінг' }));
    await waitFor(() => {
      expect(sent.moves).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    });
  });

  it('with no silent card shows the drawn empty panel with the user threshold', async () => {
    renderPage({ cards: [], items: [] });

    expect(await screen.findByText('Нагадування · порожньо')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Усі відповіли' })).toBeDefined();
    expect(
      await screen.findByText(
        'Жодної картки без подій довше 12 днів. Саме такий вигляд цього екрана найкращий.',
      ),
    ).toBeDefined();
    expect(screen.getByText('0 карток у тиші')).toBeDefined();
  });

  it('lists the planned interviews of the next two weeks with their time and card link', async () => {
    const { sent } = renderPage();

    const interview = await screen.findByRole('link', { name: /Acme/ });
    expect(interview.textContent).toContain("техінтерв'ю завтра, 14:00");
    expect(interview.getAttribute('href')).toBe(
      `/applications/${NEXT_INTERVIEW.extendedProps.applicationId}`,
    );
    expect(sent.calendar).toEqual([
      { from: '2026-11-14T10:00:00.000Z', to: '2026-11-28T10:00:00.000Z' },
    ]);
  });

  it('with no interview ahead says so in one line', async () => {
    renderPage({ interviews: [] });

    expect(await screen.findByText(COPY.interviews.empty)).toBeDefined();
  });

  it('a failed reminders request offers a retry in the silence section while interviews still show', async () => {
    const { user } = renderPage({ listReply: REFUSED_CONNECTION.reply });
    const retry = await findRetryAfterQueryRetries();
    expect(screen.getByRole('link', { name: /Acme/ })).toBeDefined();
    server.use(...remindersRoutes().handlers);

    await user.click(retry);

    expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme', 'Kvit Software']);
  });
});
