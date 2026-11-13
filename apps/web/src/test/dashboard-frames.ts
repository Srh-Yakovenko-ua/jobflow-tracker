import { screen } from '@testing-library/react';
import { createElement } from 'react';

import { AnalyticsDashboard } from '@/widgets/analytics-dashboard';

import { dashboardRoutes, type DashboardRoutesOptions } from './analytics-fixtures';
import { push } from './navigation';
import { type BarHit, CLICK, drawnChartIn, type RecordedBarChart } from './recorded-chart';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { meRoute } from './session-fixtures';

export type BlockNames = Readonly<{ eyebrow: string; table: string }>;

export type DrawnBlock = Readonly<{
  frame: HTMLElement;
  table: HTMLElement;
  chart: RecordedBarChart;
}>;

export function frameOf(eyebrow: string): HTMLElement {
  const frame = screen.getByText(eyebrow).closest('section');
  if (frame === null) throw new Error(`no frame under "${eyebrow}"`);
  return frame;
}

export function renderDashboardBlocks(options: DashboardRoutesOptions = {}): void {
  server.use(meRoute(), ...dashboardRoutes(options).handlers);
  renderInApp(createElement(AnalyticsDashboard));
}

export async function drawnBlock({ eyebrow, table }: BlockNames): Promise<DrawnBlock> {
  renderDashboardBlocks();
  const shown = await screen.findByRole('table', { name: table });
  const frame = frameOf(eyebrow);
  return { frame, table: shown, chart: drawnChartIn(frame) };
}

export function chartLabels(chart: RecordedBarChart): string[] {
  return (chart.data.labels ?? []).map((label) =>
    Array.isArray(label) ? label.join(' / ') : String(label),
  );
}

export function pressedHref(chart: RecordedBarChart, hit: BarHit): string | undefined {
  push.mockClear();
  chart.options?.onClick?.(CLICK, [hit]);
  return push.mock.lastCall?.[0];
}
