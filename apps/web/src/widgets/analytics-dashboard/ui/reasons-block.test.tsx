import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { drawnBlock, frameOf, pressedHref, renderDashboardBlocks } from '@/test/dashboard-frames';
import { tableCells } from '@/test/table-rows';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const REASONS = { eyebrow: 'причини відмов за етапами', table: 'Причини відмов за етапами' };

describe('ReasonsBlock', () => {
  it('draws the four stages with the company and candidate stacks apart, skills gap in clay, under the served conclusion', async () => {
    const { frame, chart } = await drawnBlock(REASONS);
    const { datasets } = chart.data;

    expect(chart.data.labels).toEqual(['відгук', 'скринінг', "техінтерв'ю", 'фінал']);
    const skillsGap = datasets.find(({ label }) => label === 'не вистачає скілів 6');
    expect([skillsGap?.stack, skillsGap?.backgroundColor]).toEqual([
      'company',
      CHART_THEME.light.outcome.rejected,
    ]);
    expect(datasets.filter(({ stack }) => stack === 'candidate').map(({ label }) => label)).toEqual(
      ['низька вилка 2', 'офіс/графік 2', 'ред флаги 2', 'прийняв інший офер 2'],
    );
    expect(chart.options?.plugins?.legend?.position).toBe('bottom');
    expect(
      within(frame).getByRole('heading', {
        name: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
      }),
    ).toBeDefined();
    expect(
      within(frame).getByText('3 із 4 відмов на цьому етапі — «не вистачає скілів».'),
    ).toBeDefined();
    expect(
      within(frame).getByRole('img', {
        name: /^Причини відмов за етапами: не вистачає скілів 6, /,
      }),
    ).toBeDefined();
  });

  it('shows a percent only where the stage has five rejections or more', async () => {
    const { table } = await drawnBlock(REASONS);
    const cells = tableCells(table);

    expect(cells[0]).toEqual(['відгук', 'компанія', 'не вистачає скілів', '3', '18%']);
    const small = cells.filter(([stage]) => stage === "техінтерв'ю" || stage === 'фінал');
    expect(small).toHaveLength(4);
    for (const row of small) expect(row.join(' ')).not.toContain('%');
  });

  it('a bar opens the board filtered to rejections, and the table gives the keyboard the same link', async () => {
    const { table, chart } = await drawnBlock(REASONS);

    expect(pressedHref(chart, { datasetIndex: 0, index: 2 })).toBe('/board?stage=rejected');
    expect(table.parentElement?.className).toContain('focus-within:not-sr-only');
    const [link] = within(table).getAllByRole('link', { name: 'не вистачає скілів' });
    link?.focus();
    expect(document.activeElement).toBe(link);
    expect(link?.getAttribute('href')).toBe('/board?stage=rejected');
    expect(link?.className).toContain('min-h-11');
    expect(link?.className).toContain('min-w-11');
  });

  it('a search without stated rejections shows the compact empty state instead of a chart', async () => {
    renderDashboardBlocks({ reasons: { stages: [], headline: null } });

    const frame = frameOf(REASONS.eyebrow);
    expect(await within(frame).findByRole('heading', { name: 'Причин ще немає' })).toBeDefined();
    expect(frame.querySelector('canvas')).toBeNull();
  });
});
