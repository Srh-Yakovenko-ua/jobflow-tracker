import { buildDesignMatchValidation } from '@jobflow/shared/testing';
import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { lowDataMatchValidation } from '@/test/analytics-fixtures';
import { chartLabels, drawnBlock, meterOf, renderedFrame } from '@/test/dashboard-frames';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const MATCH = {
  eyebrow: 'Match Score · перевірка на відгуках',
  table: 'Match Score і результати відгуків',
};

describe('match validation block', () => {
  it('draws the interview rate of each Match Score bucket with its interval under the served conclusion and the correlation', async () => {
    const { frame, chart } = await drawnBlock(MATCH);
    const [interview, whisker] = chart.data.datasets;

    expect(
      within(frame).getByRole('heading', {
        name: "Вакансії зі збігом 75+ доходять до інтерв'ю у 3,7 раза частіше, ніж до 50",
      }),
    ).toBeDefined();
    expect(chartLabels(chart)).toEqual([
      'до 50 / 51 відгук',
      '50–74 / 54 відгуки',
      '75+ / 45 відгуків',
    ]);
    expect(interview?.data).toEqual([14, 41, 51]);
    expect(whisker?.data).toEqual([
      [7, 26],
      [29, 54],
      [37, 65],
    ]);
    expect(within(frame).getByText('кореляція 0,35 на 150 відгуках')).toBeDefined();
    expect(
      within(frame).getByText('6 відгуків без Match Score не входять у розрахунок.'),
    ).toBeDefined();
  });

  it('no bucket with five samples shows the low data meter with the statistics message', async () => {
    const frame = await renderedFrame({
      eyebrow: MATCH.eyebrow,
      options: { 'match-validation': lowDataMatchValidation() },
      shows: 'Ще 6 відгуків до першого висновку',
    });

    expect(meterOf(frame)).toEqual(['4', '10']);
    expect(frame.querySelector('canvas')).toBeNull();
  });

  it('without a scored application the block shows the empty copy', async () => {
    const frame = await renderedFrame({
      eyebrow: MATCH.eyebrow,
      options: { 'match-validation': { ...buildDesignMatchValidation(), scored: 0 } },
      shows: 'Match Score ще немає',
    });

    expect(frame.querySelector('canvas')).toBeNull();
  });
});
