import { DEFAULT_SEARCH_TITLE } from '@jobflow/shared';
import { renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARCHIVED_SEARCH, dashboardRoutes } from '@/test/analytics-fixtures';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import { NO_SUMMARY, summaryRoutes } from '@/test/summary-fixtures';

import AnalyticsReportRoute from './page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

function routeFor(query: Record<string, string>) {
  const { result } = renderHook(() =>
    AnalyticsReportRoute({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }),
  );
  return result.current;
}

beforeEach(() => {
  fakeTimeouts();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the analytics report page', () => {
  it('a period change remounts the report with the new search scope', async () => {
    server.use(
      meRoute(),
      ...summaryRoutes({ latest: NO_SUMMARY }).handlers,
      ...dashboardRoutes({}).handlers,
    );
    const { view } = renderViewInApp(await routeFor({ period: ARCHIVED_SEARCH.id }));
    expect(await screen.findByText('Пошук 2025')).toBeDefined();

    view.rerender(await routeFor({}));

    expect(await screen.findByText(DEFAULT_SEARCH_TITLE)).toBeDefined();
    expect(screen.queryByText('Пошук 2025')).toBeNull();
  });
});
