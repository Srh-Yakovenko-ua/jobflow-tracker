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

type OkForecast = Extract<ForecastResponse, { status: 'ok' }>;

export type ForecastPace = Pick<OkForecast, 'applicationsPerWeek' | 'medianWeeks'>;

export const DESIGN_STORY_PACE = {
  applicationsPerWeek: 4.0,
  medianWeeks: 7.57,
} as const satisfies ForecastPace;

export function buildForecastAt(pace: ForecastPace): OkForecast {
  return { ...buildForecast(), applications: 54, offers: 1, ...pace };
}

export function buildInsufficientForecast(): Extract<
  ForecastResponse,
  { status: 'insufficient_data' }
> {
  return {
    status: 'insufficient_data',
    have: 9,
    need: 15,
    message: 'Ще 6 відгуків до прогнозу',
  };
}

export function buildDesignWhatIfForecast(): Extract<ForecastResponse, { status: 'ok' }> {
  return {
    ...buildForecast(),
    medianWeeks: 6.4,
    likely: { low: 3.9, high: 11.8 },
    interval: { low: 2.6, high: 16.1 },
    withinFourWeeks: 0.26,
    withinEightWeeks: 0.61,
  };
}
