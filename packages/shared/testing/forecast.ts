import type { ForecastResponse } from '../src/schemas/analytics-forecast.js';

export function buildForecast(): Extract<ForecastResponse, { status: 'ok' }> {
  return {
    status: 'ok',
    medianWeeks: 4.39,
    likely: { low: 2.29, high: 8.56 },
    interval: { low: 2.0, high: 16.82 },
    withinFourWeeks: 0.4448,
    withinEightWeeks: 0.7323,
    applicationsPerWeek: 2.0,
    applications: 28,
    offers: 2,
    horizonWeeks: 52,
  };
}
