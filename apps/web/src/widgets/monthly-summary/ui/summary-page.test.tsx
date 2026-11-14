import type { YearMonth } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { latestPlanQueryOptions } from '@/entities/plan';
import { ANY_IDEMPOTENCY_KEY, errorReply } from '@/test/api-handlers';
import { jobRoute, PROCESSING_JOB } from '@/test/job-fixtures';
import { planRoutes } from '@/test/plan-fixtures';
import { findRetryAfterQueryRetries } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import {
  DESIGN_SUMMARY,
  latestOf,
  NO_SUMMARY,
  READY_SUMMARY,
  SUMMARY_PLAN,
  summaryRoutes,
  type SummaryRoutesOptions,
} from '@/test/summary-fixtures';

import { SummaryPage } from './summary-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

type PageOptions = SummaryRoutesOptions & Readonly<{ month?: YearMonth }>;

const SAVE = 'Зберегти як план';

const REGENERATE = 'Перегенерувати';

function PlanReader() {
  useQuery(latestPlanQueryOptions());
  return null;
}

function renderPage({ month = DESIGN_SUMMARY.month, ...options }: PageOptions = {}) {
  const summaries = summaryRoutes({ latest: READY_SUMMARY, ...options });
  const plans = planRoutes({ plan: null });
  const jobs = jobRoute({ job: () => PROCESSING_JOB });
  server.use(meRoute(), ...summaries.handlers, ...plans.handlers, jobs.handler);
  const user = renderInApp(
    <>
      <SummaryPage month={month} />
      <PlanReader />
    </>,
  );
  return { user, sent: summaries.sent, plans: plans.sent };
}

function hrefOf(name: string | RegExp): string | null {
  return screen.getByRole('link', { name }).getAttribute('href');
}

describe('SummaryPage', () => {
  it('reads the month: title, ready time, the text and the numbered actions for the plan month', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Як пройшов серпень' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Саммарі за серпень 2026' }),
    ).toBeDefined();
    expect(screen.getByText('місячне AI-саммарі · серпень')).toBeDefined();
    expect(await screen.findByText('готово · 01.09, 07:00')).toBeDefined();
    expect(screen.getByText(/^За серпень ти надіслав/)).toBeDefined();
    const actions = screen.getByRole('list', { name: 'що зробити у вересні' });
    const items = within(actions).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual(
      DESIGN_SUMMARY.actions.map((action) => action.title),
    );
    expect(within(actions).getByText('Рефералки дали 3 скринінги на 3 відгуки.')).toBeDefined();
    expect(
      within(actions).getByText('Більше скринінгів без нових холодних відгуків.'),
    ).toBeDefined();
    expect(hrefOf('До аналітики')).toBe('/analytics');
  });

  it('a highlighted number links to its chart on the dashboard and its tooltip names the chart', async () => {
    const { user } = renderPage();
    await screen.findByRole('heading', { name: 'Як пройшов серпень' });

    expect(hrefOf('19, Дивитись на графіку: відгуки')).toBe('/analytics#kpis');
    expect(hrefOf('24%, Дивитись на графіку: A/B резюме')).toBe('/analytics#resume-ab');
    expect(screen.getAllByRole('link', { name: /Дивитись на графіку: воронка$/ })).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /^v2/ })).toBeNull();

    await user.hover(screen.getByRole('link', { name: '19, Дивитись на графіку: відгуки' }));
    expect((await screen.findByRole('tooltip')).textContent).toBe('Дивитись на графіку: відгуки');
  });

  it('Зберегти як план posts once with an Idempotency-Key, shows the saved plan and reloads it for the reminders', async () => {
    const { user, sent, plans } = renderPage();
    await waitFor(() => {
      expect(plans.latestReads).toBe(1);
    });

    await user.click(await screen.findByRole('button', { name: SAVE }));

    expect(await screen.findByText('План збережено.')).toBeDefined();
    expect(hrefOf('Відкрити в нагадуваннях')).toBe('/reminders');
    expect(screen.queryByRole('button', { name: SAVE })).toBeNull();
    expect(sent.plans).toEqual([
      { aiJobId: DESIGN_SUMMARY.aiJobId, idempotencyKey: ANY_IDEMPOTENCY_KEY },
    ]);
    await waitFor(() => {
      expect(plans.latestReads).toBe(2);
    });
  });

  it('a summary whose plan is already saved shows the saved line straight away', async () => {
    renderPage({ latest: latestOf({ ...DESIGN_SUMMARY, planId: SUMMARY_PLAN.id }) });

    expect(await screen.findByText('План збережено.')).toBeDefined();
    expect(screen.queryByRole('button', { name: SAVE })).toBeNull();
  });

  it('Перегенерувати posts a request and turns the block into the calm generating state', async () => {
    const { user, sent } = renderPage();

    await user.click(await screen.findByRole('button', { name: REGENERATE }));

    expect(await screen.findByText('AI пише саммарі')).toBeDefined();
    expect(await screen.findByText('~20 с · можна закрити сторінку')).toBeDefined();
    expect(sent.requests).toEqual([ANY_IDEMPOTENCY_KEY]);
    expect(screen.queryByRole('heading', { name: 'Як пройшов серпень' })).toBeNull();
  });

  it.each([
    {
      status: 409,
      type: 'conflict',
      line: 'Немає активного пошуку, тож саммарі нема з чого писати.',
    },
    {
      status: 429,
      type: 'rate_limited',
      line: 'Забагато запитів до AI за годину. Спробуй трохи пізніше.',
    },
  ])(
    'a $status on Перегенерувати becomes one line under the buttons',
    async ({ status, type, line }) => {
      const { user } = renderPage({ requestReply: () => errorReply({ status, type }) });

      await user.click(await screen.findByRole('button', { name: REGENERATE }));

      expect((await screen.findByRole('alert')).textContent).toBe(line);
      expect(screen.getByRole('heading', { name: 'Як пройшов серпень' })).toBeDefined();
    },
  );

  it('an archive month shows its summary and saved plan but offers no Перегенерувати', async () => {
    renderPage({ month: '2026-07' });

    expect(await screen.findByRole('heading', { name: 'Як пройшов липень' })).toBeDefined();
    expect(screen.getByText('що зробити у серпні')).toBeDefined();
    expect(screen.getByText('План збережено.')).toBeDefined();
    expect(screen.queryByRole('button', { name: REGENERATE })).toBeNull();
  });

  it('the archive lists the other months with their plan progress', async () => {
    renderPage();

    const archive = await screen.findByRole('region', { name: 'попередні місяці' });
    const rows = within(archive).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'липень 20263 з 4 виконано',
      'червень 2026план не збережено',
    ]);
    expect(within(archive).getByRole('link', { name: 'липень 2026' }).getAttribute('href')).toBe(
      '/analytics/summary/2026-07',
    );
  });

  it('a month with no summary says so and leads to the latest one', async () => {
    renderPage({ month: '2026-05' });

    expect(
      await screen.findByRole('heading', { name: 'За травень 2026 саммарі немає' }),
    ).toBeDefined();
    expect(hrefOf('До останнього саммарі')).toBe('/analytics/summary/2026-08');
    expect(screen.getByText(/Останнє вже чекає\.$/)).toBeDefined();
  });

  it('a month with no summary and no latest one says the summary arrives on the 1st', async () => {
    renderPage({ month: '2026-05', latest: NO_SUMMARY });

    expect(
      await screen.findByRole('heading', { name: 'За травень 2026 саммарі немає' }),
    ).toBeDefined();
    expect(
      screen.getByText('Саммарі пишеться за місяць, що минув, і приходить першого числа.'),
    ).toBeDefined();
    expect(screen.queryByText(/Останнє вже чекає/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'До останнього саммарі' })).toBeNull();
  });

  it('a failed read shows the error, and its retry reads the summary again', async () => {
    const down = { on: true };
    const { user } = renderPage({
      latestReply: () =>
        down.on
          ? errorReply({ status: 500, type: 'internal_error' })
          : Response.json(READY_SUMMARY),
    });

    const retry = await findRetryAfterQueryRetries();
    down.on = false;
    await user.click(retry);

    expect(await screen.findByRole('heading', { name: 'Як пройшов серпень' })).toBeDefined();
  });
});
