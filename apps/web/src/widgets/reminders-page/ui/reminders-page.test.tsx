import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { apiUrl, errorReply, REFUSED_CONNECTION } from '@/test/api-handlers';
import { boardRoute, moveRoute } from '@/test/board-fixtures';
import { calendarRoute } from '@/test/calendar-fixtures';
import { pinClockInEachTest } from '@/test/pinned-clock';
import { DESIGN_PLAN, type PlanRouteOptions, planRoutes } from '@/test/plan-fixtures';
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
  plan?: PlanRouteOptions;
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
  plan = {},
  ...routes
}: PageRoutes = {}) {
  const reminders = remindersRoutes(routes);
  const plans = planRoutes(plan);
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
    ...plans.handlers,
  );
  const user = renderInApp(<RemindersPage />);
  return {
    user,
    sent: { ...reminders.sent, calendar: calendar.sent, moves: moves.sent, plans: plans.sent },
  };
}

function rowOf(company: string) {
  return within(screen.getByRole('article', { name: company }));
}

const ACTION_TITLES = buildMonthlySummaryOutput().actions.map((action) => action.title);

const LAST_ITEM = DESIGN_PLAN.items[3];

function lastCheckbox() {
  return screen.getByRole('checkbox', { name: LAST_ITEM?.title ?? '' });
}

async function planChecks() {
  await screen.findByText(COPY.plan.progress({ items: 4, done: 3 }));
  return screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-checked'));
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

  it('План lists the saved plan in item order with its progress, why, effect and due date', async () => {
    renderPage();

    expect(await planChecks()).toEqual(['true', 'true', 'true', 'false']);
    expect(screen.getByText('з 4 пунктів виконано 3')).toBeDefined();
    expect(screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(
      ACTION_TITLES,
    );
    const [first] = buildMonthlySummaryOutput().actions;
    expect(screen.getByText(first?.why ?? '')).toBeDefined();
    expect(screen.getByText(first?.expectedEffect ?? '')).toBeDefined();
    expect(screen.getByText('до 20.11')).toBeDefined();
  });

  it('checking a plan item sends the PATCH and the item stays checked after the refetch', async () => {
    const { user, sent } = renderPage();
    await planChecks();

    await user.click(lastCheckbox());

    await waitFor(() => {
      expect(sent.plans.latestReads).toBe(2);
    });
    expect(sent.plans.patches).toEqual([
      { planId: DESIGN_PLAN.id, itemId: LAST_ITEM?.id, body: { done: true } },
    ]);
    expect(lastCheckbox().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('з 4 пунктів виконано 4')).toBeDefined();
  });

  it('a 500 on a plan item check rolls the box back and says the check failed', async () => {
    const { user } = renderPage({
      plan: { patchReply: () => errorReply({ status: 500, type: 'internal_error' }) },
    });
    await planChecks();

    await user.click(lastCheckbox());

    expect(await screen.findByText(COPY.plan.toggleFailed.title)).toBeDefined();
    await waitFor(() => {
      expect(lastCheckbox().getAttribute('aria-checked')).toBe('false');
    });
  });

  it('with no saved plan says how a plan appears', async () => {
    renderPage({ plan: { plan: null } });

    expect(await screen.findByText(COPY.plan.empty)).toBeDefined();
    expect(screen.getByRole('heading', { name: COPY.plan.title })).toBeDefined();
  });

  it('a failed plan request offers a retry in the plan section while the silence list still shows', async () => {
    const { user } = renderPage({ plan: { latestReply: REFUSED_CONNECTION.reply } });
    const retry = await findRetryAfterQueryRetries();
    expect(await silentCompanies()).toEqual(['Zoria Tech', 'Acme', 'Kvit Software']);
    server.use(...planRoutes().handlers);

    await user.click(retry);

    expect(await planChecks()).toEqual(['true', 'true', 'true', 'false']);
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
