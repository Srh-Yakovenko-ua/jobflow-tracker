import { buildDesignTimings } from '@jobflow/shared/testing';
import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { lowDataTimings } from '@/test/analytics-fixtures';
import {
  chartLabels,
  drawnBlock,
  meterOf,
  pressedHref,
  renderedFrame,
  smallNoteOf,
} from '@/test/dashboard-frames';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const TIMINGS = { eyebrow: 'час на етапах · медіана', table: 'Час на етапах' };

describe('timings block', () => {
  it("draws відгук, скринінг and техінтерв'ю at their median days with the quartiles as whiskers and sends фінал to the n<5 note", async () => {
    const { frame, chart } = await drawnBlock(TIMINGS);
    const [median, whisker] = chart.data.datasets;

    expect(chartLabels(chart)).toEqual(['відгук', 'скринінг', "техінтерв'ю"]);
    expect(median?.data).toEqual([2, 11, 5.5]);
    expect(whisker?.data).toEqual([
      [2, 6],
      [2, 11],
      [2, 9],
    ]);
    expect(frame.querySelector('.h-44')).not.toBeNull();
    expect(smallNoteOf(frame)).toEqual(['фінал: 4 заміри. Ще 1 відгук до першого висновку']);
  });

  it('a bar opens the board filtered to its stage, and the table gives the keyboard the same link', async () => {
    const { table, chart } = await drawnBlock(TIMINGS);

    expect(pressedHref(chart, { datasetIndex: 0, index: 1 })).toBe('/board?stage=screening');
    const link = within(table).getByRole('link', { name: 'скринінг' });
    expect(link.getAttribute('href')).toBe('/board?stage=screening');
  });

  it('every stage under five samples shows the low data meter and no chart', async () => {
    const frame = await renderedFrame({
      eyebrow: TIMINGS.eyebrow,
      options: { timings: lowDataTimings() },
      shows: 'Ще 2 відгуки до першого висновку',
    });

    expect(meterOf(frame)).toEqual(['3', '5']);
    expect(frame.querySelector('canvas')).toBeNull();
  });

  it('a search without stage timings shows the empty copy', async () => {
    const frame = await renderedFrame({
      eyebrow: TIMINGS.eyebrow,
      options: { timings: { ...buildDesignTimings(), stages: [] } },
      shows: 'Етапів ще немає',
    });

    expect(frame.querySelector('canvas')).toBeNull();
  });
});
