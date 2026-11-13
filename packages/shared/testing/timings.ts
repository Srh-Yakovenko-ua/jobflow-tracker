import { type TimingsResponse, timingsResponseSchema } from '../src/schemas/analytics-timings.js';

const DESIGN_TIMINGS: TimingsResponse = {
  ghostRate: {
    gap: { points: 9, position: 'above' },
    market: {
      high: 0.22,
      low: 0.18,
      source:
        'Greenhouse platform data, 2024: 18 to 22% of jobs posted on Greenhouse in a quarter are ghost jobs',
      url: 'https://www.entrepreneur.com/business-news/ghost-job-listings-on-the-rise-how-to-spot-avoid-experts/485494',
    },
    rate: {
      high: 0.4474344482,
      low: 0.2067928066,
      status: 'ok',
      successes: 17,
      trials: 54,
      value: 0.3148148148,
    },
  },
  medianDaysToOffer: {
    have: 1,
    message: 'Ще 4 відгуки до першого висновку',
    need: 4,
    status: 'insufficient_data',
  },
  responseTime: { hours: 144.0, samples: 33, status: 'ok' },
  stages: [
    {
      lowerQuartileDays: 2.0,
      medianDays: 2.0,
      samples: 40,
      stage: 'applied',
      status: 'ok',
      upperQuartileDays: 6.0,
    },
    {
      lowerQuartileDays: 2.0,
      medianDays: 11.0,
      samples: 15,
      stage: 'screening',
      status: 'ok',
      upperQuartileDays: 11.0,
    },
    {
      lowerQuartileDays: 2.0,
      medianDays: 5.5,
      samples: 8,
      stage: 'tech_interview',
      status: 'ok',
      upperQuartileDays: 9.0,
    },
    {
      have: 4,
      message: 'Ще 1 відгук до першого висновку',
      need: 1,
      stage: 'final',
      status: 'insufficient_data',
    },
  ],
};

export function buildDesignTimings(): TimingsResponse {
  return timingsResponseSchema.parse(DESIGN_TIMINGS);
}
