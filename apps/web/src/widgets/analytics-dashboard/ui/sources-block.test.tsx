import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  chartLabels,
  drawnBlock,
  frameOf,
  pressedHref,
  renderDashboardBlocks,
} from '@/test/dashboard-frames';
import { tableCells } from '@/test/table-rows';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const SOURCES = { eyebrow: 'конверсія за джерелами', table: 'Конверсія за джерелами' };

const SMALL = ['рефералка', 'сайт компанії', 'robota.ua'];

describe('SourcesBlock', () => {
  it('plots Djinni, DOU and LinkedIn at their served conversion with interval whiskers and raw application counts', async () => {
    const { frame, chart } = await drawnBlock(SOURCES);
    const [conversion, whisker] = chart.data.datasets;

    expect(chartLabels(chart)).toEqual([
      'Djinni / 24 відгуки',
      'DOU / 6 відгуків',
      'LinkedIn / 16 відгуків',
    ]);
    expect(conversion?.data).toEqual([45, 40, 22]);
    expect(whisker?.data).toEqual([
      [26, 66],
      [12, 77],
      [6, 55],
    ]);
    expect(whisker?.grouped).toBe(false);
    expect(
      within(frame).getByRole('heading', { name: "LinkedIn з'їдає час, рефералки — ні" }),
    ).toBeDefined();
    expect(
      within(frame).getByText('16 відгуків через LinkedIn дали 2 скринінги. Djinni при 24 — 9.'),
    ).toBeDefined();
  });

  it('keeps sources under five samples out of the chart and lists them in the n<5 note with raw counts and no percent', async () => {
    const { frame, table, chart } = await drawnBlock(SOURCES);

    expect(chartLabels(chart).join(' ')).not.toMatch(/рефералка|сайт компанії|robota/);
    const note = within(frame).getByText('n<5').parentElement;
    expect(
      within(note ?? frame)
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual([
      'рефералка: 3 відгуки, 3 скринінги. вибірка мала, але напрям однозначний',
      'сайт компанії: 2 відгуки, 1 скринінг. Відсоток на такій вибірці лише шум.',
      'robota.ua: 3 відгуки, 0 скринінгів. Відсоток на такій вибірці лише шум.',
    ]);
    const small = tableCells(table).filter(([source]) => SMALL.includes(source ?? ''));
    expect(small).toHaveLength(3);
    for (const row of small) expect(row.join(' ')).not.toContain('%');
  });

  it('a bar opens the board filtered to its source, and the table gives the keyboard the same link', async () => {
    const { table, chart } = await drawnBlock(SOURCES);

    expect(pressedHref(chart, { datasetIndex: 0, index: 2 })).toBe('/board?source=linkedin');
    const link = within(table).getByRole('link', { name: 'LinkedIn' });
    expect(link.getAttribute('href')).toBe('/board?source=linkedin');
    expect(link.className).toContain('min-h-11');
  });

  it('a search without sources shows the compact empty state instead of a chart', async () => {
    renderDashboardBlocks({ sources: { sources: [], silentGhosts: { total: 0, easyApply: 0 } } });

    const frame = frameOf(SOURCES.eyebrow);
    expect(await within(frame).findByRole('heading', { name: 'Джерел ще немає' })).toBeDefined();
    expect(frame.querySelector('canvas')).toBeNull();
  });
});
