import { within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { lowDataResumeAb } from '@/test/analytics-fixtures';
import {
  chartLabels,
  drawnBlock,
  meterOf,
  renderedFrame,
  smallNoteOf,
} from '@/test/dashboard-frames';
import { DESIGN_RESUME_AB } from '@/test/resume-ab-fixtures';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('react-chartjs-2', () => import('@/test/recorded-chart'));

const ONLY = DESIGN_RESUME_AB.versions.slice(0, 1);

const RESUME_AB = { eyebrow: 'порівняння версій резюме', table: 'Конверсія за версіями резюме' };

describe('ResumeAbBlock', () => {
  it('draws v2 and v1 at 41% and 24% with interval whiskers under the served verdict, then the probability and the switch', async () => {
    const { frame, chart } = await drawnBlock(RESUME_AB);
    const [conversion, whisker] = chart.data.datasets;

    expect(within(frame).getByRole('heading', { name: 'Схоже, CV v2 працює краще' })).toBeDefined();
    expect(chartLabels(chart)).toEqual(['CV v2 · акцент на продукті', 'CV v1 · хронологічне']);
    expect(conversion?.data).toEqual([41, 24]);
    expect(whisker?.data).toEqual([
      [25, 59],
      [11, 45],
    ]);
    expect(frame.querySelector('.h-42')).not.toBeNull();
    expect(within(frame).getByText('Імовірність, що CV v2 краще за v1: 88%')).toBeDefined();
    expect(
      within(frame).getByText('Після переходу на CV v2 02.12: конверсія 24% → 41%'),
    ).toBeDefined();
    expect(smallNoteOf(frame)).toEqual([
      'CV v3: 3 відгуки, 1 скринінг. Відсоток на такій вибірці лише шум.',
    ]);
  });

  it('a verdict short of ten applications per version shows the low data meter and no chart', async () => {
    const frame = await renderedFrame({
      eyebrow: RESUME_AB.eyebrow,
      options: { 'resume-ab': lowDataResumeAb() },
      shows: 'Ще 6 відгуків до першого висновку',
    });

    expect(meterOf(frame)).toEqual(['4', '10']);
    expect(frame.querySelector('canvas')).toBeNull();
    expect(
      within(frame).getByRole('heading', { name: 'Яка версія резюме працює краще' }),
    ).toBeDefined();
  });

  it.each([
    { name: 'no versions', versions: [], shows: 'Версій резюме ще немає' },
    { name: 'a single version', versions: ONLY, shows: 'Поки що лише одна версія резюме' },
  ])('with $name the block shows its own empty copy and no chart', async ({ versions, shows }) => {
    const frame = await renderedFrame({
      eyebrow: RESUME_AB.eyebrow,
      options: { 'resume-ab': { versions, comparison: null } },
      shows,
    });

    expect(frame.querySelector('canvas')).toBeNull();
  });
});
