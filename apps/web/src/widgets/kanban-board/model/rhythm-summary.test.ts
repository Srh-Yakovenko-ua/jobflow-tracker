import type { ForecastResponse } from '@jobflow/shared';
import { buildForecast, buildInsufficientForecast } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { buildRhythm, DESIGN_DOTS, RHYTHM_GOAL_OFF, withCurrentWeek } from '@/test/rhythm-fixtures';

import { rhythmSummaryOf, weeksSoonerOf } from './rhythm-summary';

const forecastAt = (medianWeeks: number | null): ForecastResponse => ({
  ...buildForecast(),
  medianWeeks,
});

describe('rhythmSummaryOf', () => {
  it('reads the current week against the goal, fills the dots of the weeks in rhythm and says it as one sentence', () => {
    const summary = rhythmSummaryOf(buildRhythm());

    expect(summary).toMatchObject({
      line: 'Цей тиждень: 5 із 8 відгуків · 2 фоллоу-апи',
      sentence: 'Цей тиждень: 5 із 8 відгуків, 2 фоллоу-апи; у ритмі 3 з 8 останніх тижнів.',
      share: 0.625,
      suggestedGoal: null,
    });
    expect(summary?.dots.map(({ filled }) => filled)).toEqual(DESIGN_DOTS);
  });

  it('counts the follow-ups against their own goal once one is set', () => {
    const summary = rhythmSummaryOf(buildRhythm({ goal: { applications: 8, followups: 3 } }));

    expect(summary?.line).toBe('Цей тиждень: 5 із 8 відгуків · 2 із 3 фоллоу-апів');
  });

  it('a week past the goal fills the bar and no further', () => {
    const summary = rhythmSummaryOf(withCurrentWeek(buildRhythm(), { applications: 12 }));

    expect(summary?.share).toBe(1);
  });

  it('a goal of one names the single application', () => {
    const rhythm = buildRhythm({ goal: { applications: 1, followups: null } });

    expect(rhythmSummaryOf(withCurrentWeek(rhythm, { applications: 0 }))?.line).toBe(
      'Цей тиждень: 0 із 1 відгуку · 2 фоллоу-апи',
    );
  });

  it('gives nothing to show while the goal is off', () => {
    expect(rhythmSummaryOf(RHYTHM_GOAL_OFF)).toBeNull();
  });

  it('a paused week names the return day and drops the bar', () => {
    const rhythm = withCurrentWeek(
      buildRhythm({ pausedFrom: '2026-11-16', pausedUntil: '2026-11-23' }),
      { status: 'paused' },
    );

    const summary = rhythmSummaryOf(rhythm);

    expect(summary?.line).toBe('Пауза до 23.11');
    expect(summary?.sentence).toBe('Пауза до 23.11; у ритмі 3 з 8 останніх тижнів.');
    expect(summary?.share).toBeNull();
  });

  it.each([
    { suggestedGoal: 10, shown: 10 },
    { suggestedGoal: 8, shown: null },
    { suggestedGoal: null, shown: null },
  ])(
    'a suggested goal of $suggestedGoal against a goal of 8 offers $shown',
    ({ suggestedGoal, shown }) => {
      expect(rhythmSummaryOf(buildRhythm({ suggestedGoal }))?.suggestedGoal).toBe(shown);
    },
  );
});

describe('weeksSoonerOf', () => {
  it.each([
    { name: '4.39 down to 2.2 weeks is 2 weeks sooner', whatIf: forecastAt(2.2), sooner: 2 },
    { name: 'under half a week sooner says nothing', whatIf: forecastAt(3.9), sooner: null },
    { name: 'a slower what-if says nothing', whatIf: forecastAt(6), sooner: null },
    { name: 'a what-if with no median says nothing', whatIf: forecastAt(null), sooner: null },
    { name: 'too little data says nothing', whatIf: buildInsufficientForecast(), sooner: null },
    { name: 'a forecast still on its way says nothing', whatIf: undefined, sooner: null },
  ])('$name', ({ whatIf, sooner }) => {
    expect(weeksSoonerOf({ baseline: buildForecast(), whatIf })).toBe(sooner);
  });

  it('a baseline with too little data says nothing', () => {
    expect(weeksSoonerOf({ baseline: buildInsufficientForecast(), whatIf: forecastAt(1) })).toBe(
      null,
    );
  });
});
