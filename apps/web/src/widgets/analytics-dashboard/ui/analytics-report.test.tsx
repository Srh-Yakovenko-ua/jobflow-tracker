import { DEFAULT_SEARCH_TITLE } from '@jobflow/shared';
import { buildSummary, designInsightsBody, salaryFloorInsightsBody } from '@jobflow/shared/testing';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ARCHIVED_SEARCH,
  dashboardRoutes,
  type DashboardRoutesOptions,
  queriesOf,
} from '@/test/analytics-fixtures';
import { frameOf } from '@/test/dashboard-frames';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { latestOf, NO_SUMMARY, summaryRoutes } from '@/test/summary-fixtures';

import { AnalyticsReport, type AnalyticsReportProps } from './analytics-report';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const INSIGHTS_EYEBROW = 'висновки';

const SEARCH_SCOPED = ['funnel', 'sankey', 'reasons', 'sources', 'forecast', 'insights'] as const;

const HIDE_SALARY = { name: 'Приховати зарплати' } as const;

const SALARY_TITLE = /^Відмови через зарплату/;

const MONEY_SUMMARY = buildSummary({
  text: 'Вилки нижче $4 000 не дали жодного офера.\nНаступний крок: фільтр від 4 500 USD.',
});

type ReportRender = Readonly<{
  routes?: DashboardRoutesOptions;
  latest?: typeof NO_SUMMARY;
  props?: AnalyticsReportProps;
}>;

function renderReport({ routes = {}, latest = NO_SUMMARY, props = {} }: ReportRender = {}) {
  const dashboard = dashboardRoutes(routes);
  server.use(meRoute(), ...summaryRoutes({ latest }).handlers, ...dashboard.handlers);
  return { ...renderViewInApp(<AnalyticsReport {...props} />), sent: dashboard.sent };
}

async function insightsFrame(title: RegExp | string): Promise<HTMLElement> {
  await screen.findByRole('heading', { name: title });
  return frameOf(INSIGHTS_EYEBROW);
}

beforeEach(() => {
  fakeTimeouts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AnalyticsReport', () => {
  it('the title page names the active search and its dates, then the report blocks and every insight follow, without the dashboard extras', async () => {
    renderReport();

    expect(screen.getByRole('heading', { name: 'Звіт про пошук роботи' })).toBeDefined();
    expect(await screen.findByText(DEFAULT_SEARCH_TITLE)).toBeDefined();
    expect(screen.getByText('20.08.2026–сьогодні')).toBeDefined();
    expect(await screen.findByRole('heading', { name: 'Куди пішли всі 54 відгуки' })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Відгуків надіслано' })).toBeDefined();
    for (const eyebrow of [
      'причини відмов за етапами',
      'конверсія за джерелами',
      'порівняння версій резюме',
      'прогноз офера',
    ]) {
      expect(frameOf(eyebrow)).toBeDefined();
    }
    expect(screen.queryByText('час на етапах · медіана')).toBeNull();
    expect(screen.queryByText('зарплатна аналітика · твої картки')).toBeNull();
    expect(screen.queryByText('що зробити')).toBeNull();
    const insights = within(await insightsFrame('Що показують дані'));
    for (const { title, body } of designInsightsBody().insights) {
      expect(await insights.findByRole('heading', { name: title })).toBeDefined();
      expect(insights.getByText(body)).toBeDefined();
    }
  });

  it('a period names the archived search with its start and finish and scopes every request to it', async () => {
    const { sent } = renderReport({ props: { period: ARCHIVED_SEARCH.id } });

    expect(await screen.findByText('Пошук 2025')).toBeDefined();
    expect(screen.getByText('22.09.2025–01.12.2025')).toBeDefined();
    const archived = `?searchId=${ARCHIVED_SEARCH.id}`;
    const scoped = Object.fromEntries(SEARCH_SCOPED.map((route) => [route, archived]));
    await waitFor(() => {
      expect(queriesOf(sent)).toMatchObject(scoped);
    });
  });

  it('the print button opens the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { user } = renderReport();

    await user.click(screen.getByRole('button', { name: 'Завантажити PDF' }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it('hiding salary drops the salary insight, so no dollar amount is left in the report', async () => {
    const { user, view } = renderReport({ routes: { insights: salaryFloorInsightsBody() } });
    const insights = await insightsFrame(SALARY_TITLE);
    expect(view.container.textContent).toContain('$');

    await user.click(screen.getByRole('switch', HIDE_SALARY));

    await waitFor(() => {
      expect(within(insights).queryByRole('heading', { name: SALARY_TITLE })).toBeNull();
    });
    expect(screen.getByRole('switch', HIDE_SALARY).getAttribute('aria-checked')).toBe('true');
    expect(
      within(insights).getByRole('heading', { name: 'Схоже, CV v2 працює краще' }),
    ).toBeDefined();
    expect(view.container.textContent).not.toContain('$');
  });

  it('the monthly summary prints as text, and hiding salary turns its amounts into the hidden word', async () => {
    const { user } = renderReport({ latest: latestOf(MONEY_SUMMARY) });
    const text = await screen.findByText(/^Вилки нижче \$4 000 не дали жодного офера\./);
    expect(text.textContent).toBe(MONEY_SUMMARY.text);
    expect(screen.queryByRole('button', { name: 'Перегенерувати' })).toBeNull();

    await user.click(screen.getByRole('switch', HIDE_SALARY));

    expect(text.textContent).toBe(
      'Вилки нижче приховано не дали жодного офера.\nНаступний крок: фільтр від приховано.',
    );
  });

  it('a period of an archived search leaves out the monthly summary, which speaks for the current month', async () => {
    renderReport({ latest: latestOf(MONEY_SUMMARY), props: { period: ARCHIVED_SEARCH.id } });

    expect(await screen.findByText('Пошук 2025')).toBeDefined();
    const insights = within(await insightsFrame('17 компаній не відповіли'));

    expect(insights.queryByText(/^Вилки нижче/)).toBeNull();
  });
});
