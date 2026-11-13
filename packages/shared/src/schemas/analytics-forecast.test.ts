import { describe, expect, it } from 'vitest';

import { buildForecast } from '../../testing/forecast.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { forecastQuerySchema, forecastResponseSchema } from './analytics-forecast.js';

const ONE_MORE = {
  status: 'insufficient_data',
  have: 14,
  need: 1,
  message: 'Ще 1 відгук до першого висновку',
} as const;

describe('forecastQuerySchema', () => {
  it('accepts the what-if of a tech interview conversion at 60%', () => {
    expect(forecastQuerySchema.parse({ improve: 'tech_interview:0.6' })).toEqual({
      improve: 'tech_interview:0.6',
    });
  });

  it.for([
    { label: 'an improve on the offer stage', query: { improve: 'offer:0.6' }, path: 'improve' },
    {
      label: 'a negative application rate',
      query: { applicationsPerWeek: -1 },
      path: 'applicationsPerWeek',
    },
  ])('refuses $label at $path', ({ query, path }) => {
    expect(issuePathsOf(forecastQuerySchema.safeParse(query))).toEqual([path]);
  });
});

describe('forecastResponseSchema', () => {
  it('accepts the forecast the analytics fixture returns', () => {
    expect(forecastResponseSchema.parse(buildForecast())).toEqual(buildForecast());
  });

  it('accepts null quantiles beyond the horizon', () => {
    const beyondHorizon = {
      ...buildForecast(),
      medianWeeks: null,
      likely: { low: 31.4, high: null },
      interval: { low: 12.6, high: null },
    };

    expect(forecastResponseSchema.parse(beyondHorizon)).toEqual(beyondHorizon);
  });

  it('accepts the insufficient data body one application short of the threshold', () => {
    expect(forecastResponseSchema.parse(ONE_MORE)).toEqual(ONE_MORE);
  });

  it('refuses a share of offers within four weeks above one', () => {
    expect(
      issuePathsOf(forecastResponseSchema.safeParse({ ...buildForecast(), withinFourWeeks: 1.2 })),
    ).toEqual(['withinFourWeeks']);
  });
});
