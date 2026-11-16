import { buildForecastAt, buildInsufficientForecast } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { designStoryForecastAt, recordedForecastAt } from '../../test/rhythm.js';
import { suggestedGoalOf } from './rhythm-suggestion.js';

describe('suggestedGoalOf', () => {
  it('suggests the smallest weekly number that brings the design-story offer a week closer, the same way twice', async () => {
    const first = recordedForecastAt(({ applicationsPerWeek }) =>
      designStoryForecastAt(applicationsPerWeek),
    );
    const second = recordedForecastAt(({ applicationsPerWeek }) =>
      designStoryForecastAt(applicationsPerWeek),
    );

    const suggestions = [
      await suggestedGoalOf(first.forecastAt),
      await suggestedGoalOf(second.forecastAt),
    ];

    expect(suggestions).toEqual([
      { goal: 5, weeksSooner: 2 },
      { goal: 5, weeksSooner: 2 },
    ]);
    expect(first.calls).toEqual([undefined, 17, 10, 7, 5]);
    expect(second.calls).toEqual(first.calls);
  });

  it('suggests nothing and asks no what-if below the forecast threshold', async () => {
    const { calls, forecastAt } = recordedForecastAt(() => buildInsufficientForecast());

    expect(await suggestedGoalOf(forecastAt)).toEqual({ goal: null, weeksSooner: null });
    expect(calls).toEqual([undefined]);
  });

  it('suggests nothing and asks no what-if when no offer is forecast at the current pace', async () => {
    const { calls, forecastAt } = recordedForecastAt(() =>
      buildForecastAt({ applicationsPerWeek: 4, medianWeeks: null }),
    );

    expect(await suggestedGoalOf(forecastAt)).toEqual({ goal: null, weeksSooner: null });
    expect(calls).toEqual([undefined]);
  });

  it('suggests nothing when even 30 a week moves the offer less than a week', async () => {
    const { forecastAt } = recordedForecastAt(({ applicationsPerWeek = 4 }) =>
      buildForecastAt({ applicationsPerWeek, medianWeeks: 7.57 - applicationsPerWeek / 100 }),
    );

    expect(await suggestedGoalOf(forecastAt)).toEqual({ goal: null, weeksSooner: null });
  });

  it('asks no what-if when the current pace is already 30 a week', async () => {
    const { calls, forecastAt } = recordedForecastAt(() =>
      buildForecastAt({ applicationsPerWeek: 30, medianWeeks: 3 }),
    );

    expect(await suggestedGoalOf(forecastAt)).toEqual({ goal: null, weeksSooner: null });
    expect(calls).toEqual([undefined]);
  });

  it('skips a what-if that forecasts no offer and keeps searching higher', async () => {
    const { forecastAt } = recordedForecastAt(({ applicationsPerWeek = 4 }) =>
      applicationsPerWeek < 12
        ? buildForecastAt({
            applicationsPerWeek,
            medianWeeks: applicationsPerWeek === 4 ? 9 : null,
          })
        : buildForecastAt({ applicationsPerWeek, medianWeeks: 6.6 }),
    );

    expect(await suggestedGoalOf(forecastAt)).toEqual({ goal: 12, weeksSooner: 2 });
  });
});
