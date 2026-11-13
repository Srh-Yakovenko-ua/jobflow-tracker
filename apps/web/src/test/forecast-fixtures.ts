import { type ForecastResponse, THRESHOLDS } from '@jobflow/shared';
import { buildForecast } from '@jobflow/shared/testing';

import type { OkForecast } from '@/widgets/analytics-dashboard/lib/forecast-view';

export const DESIGN_FORECAST_TEXT = {
  headline: '2–9 тижнів',
  caption: 'Ймовірний коридор: половина симуляцій. Темп 2,0 на тиждень, поточні конверсії.',
  legend: ['ймовірний коридор 2–9 тижнів', 'увесь 80% інтервал: 2–17 тижнів', 'медіана: 4,4 тижня'],
  odds: 'Офер за 4 тижні: 44%, за 8 тижнів: 73%',
  note: 'Це не обіцянка. Модель бачила 28 відгуків і 2 офери.',
} as const;

export const WHAT_IF_FORECAST: OkForecast = {
  ...buildForecast(),
  applicationsPerWeek: 2.5,
  medianWeeks: 3.1,
  likely: { low: 1.6, high: 5.2 },
  interval: { low: 1.1, high: 9.4 },
};

export const WHAT_IF_TEXT = {
  headline: '2–5 тижнів',
  likely: 'ймовірний коридор 2–5 тижнів',
} as const;

export const NO_REPLY_FORECAST: ForecastResponse = {
  status: 'insufficient_data',
  have: 0,
  need: 1,
  message: "Прогноз з'явиться після першої відповіді компанії",
};

export function forecastBelowThreshold(have: number): ForecastResponse {
  const need = THRESHOLDS.MIN_N_FORECAST - have;
  return {
    status: 'insufficient_data',
    have,
    need,
    message: `Ще ${String(need)} відгуки до першого висновку`,
  };
}
