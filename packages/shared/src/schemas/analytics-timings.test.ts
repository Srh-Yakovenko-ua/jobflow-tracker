import { describe, expect, it } from 'vitest';

import { buildDesignTimings } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  type NormsResponse,
  normsResponseSchema,
  type TimingsResponse,
  timingsResponseSchema,
} from './analytics-timings.js';

const DESIGN_NORMS = {
  stageNormDays: { applied: 4, screening: 7, tech_interview: 9, final: 17 },
  medianDaysToOffer: 37,
} as const satisfies NormsResponse;

const DESIGN_TIMINGS = {
  stages: [
    {
      status: 'ok',
      stage: 'applied',
      medianDays: 4.0,
      lowerQuartileDays: 3.0,
      upperQuartileDays: 6.0,
      samples: 5,
    },
    {
      status: 'ok',
      stage: 'screening',
      medianDays: 7.0,
      lowerQuartileDays: 6.0,
      upperQuartileDays: 10.0,
      samples: 5,
    },
    {
      status: 'ok',
      stage: 'tech_interview',
      medianDays: 9.0,
      lowerQuartileDays: 8.0,
      upperQuartileDays: 12.0,
      samples: 5,
    },
    {
      status: 'ok',
      stage: 'final',
      medianDays: 17.0,
      lowerQuartileDays: 15.0,
      upperQuartileDays: 21.0,
      samples: 5,
    },
  ],
  responseTime: { status: 'ok', hours: 96.0, samples: 5 },
  medianDaysToOffer: { status: 'ok', days: 37.0, samples: 5 },
  ghostRate: {
    rate: {
      status: 'ok',
      value: 0.0,
      low: 0.0,
      high: 0.4344824647831746,
      successes: 0,
      trials: 5,
    },
    market: {
      low: 0.18,
      high: 0.22,
      source:
        'Greenhouse platform data, 2024: 18 to 22% of jobs posted on' +
        ' Greenhouse in a quarter are ghost jobs',
      url: 'https://www.entrepreneur.com/business-news/ghost-job-listings-on-the-rise-how-to-spot-avoid-experts/485494',
    },
    gap: { position: 'below', points: 18 },
  },
} as const satisfies TimingsResponse;

const FINAL_WITH_FOUR_STAYS = {
  status: 'insufficient_data',
  stage: 'final',
  have: 4,
  need: 1,
  message: 'Ще 1 відгук до першого висновку',
} as const;

const NORMS_WITHOUT_FINAL = Object.fromEntries(
  Object.entries(DESIGN_NORMS.stageNormDays).filter(([stage]) => stage !== 'final'),
);

describe('normsResponseSchema', () => {
  it('accepts the design norms where the final stage norm is 17 days', () => {
    expect(normsResponseSchema.parse(DESIGN_NORMS)).toEqual(DESIGN_NORMS);
  });

  it('accepts a null norm for a stage below the threshold', () => {
    const body = { ...DESIGN_NORMS, stageNormDays: { ...DESIGN_NORMS.stageNormDays, final: null } };
    expect(normsResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a missing stage key',
      body: { ...DESIGN_NORMS, stageNormDays: NORMS_WITHOUT_FINAL },
      path: 'stageNormDays.final',
    },
    {
      label: 'a negative norm',
      body: { ...DESIGN_NORMS, stageNormDays: { ...DESIGN_NORMS.stageNormDays, applied: -1 } },
      path: 'stageNormDays.applied',
    },
    {
      label: 'a fractional median to offer',
      body: { ...DESIGN_NORMS, medianDaysToOffer: 33.5 },
      path: 'medianDaysToOffer',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(normsResponseSchema.safeParse(body))).toEqual([path]);
  });
});

describe('timingsResponseSchema', () => {
  it('accepts the design timings with stage medians 4, 7, 9 and 17 days', () => {
    expect(timingsResponseSchema.parse(DESIGN_TIMINGS)).toEqual(DESIGN_TIMINGS);
  });

  it('accepts the timings of the 54 design applications with a 31% ghost rate', () => {
    const body = buildDesignTimings();
    expect(timingsResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts an insufficient stage that keeps its stage and a gap of null', () => {
    const body = {
      ...DESIGN_TIMINGS,
      stages: [...DESIGN_TIMINGS.stages.slice(0, 3), FINAL_WITH_FOUR_STAYS],
      ghostRate: { ...DESIGN_TIMINGS.ghostRate, rate: FINAL_WITH_FOUR_STAYS, gap: null },
    };
    expect(timingsResponseSchema.parse(body).stages[3]).toEqual(FINAL_WITH_FOUR_STAYS);
  });

  it.for([
    {
      label: 'an unknown gap position',
      body: {
        ...DESIGN_TIMINGS,
        ghostRate: { ...DESIGN_TIMINGS.ghostRate, gap: { position: 'equal', points: 0 } },
      },
      path: 'ghostRate.gap.position',
    },
    {
      label: 'a stage that carries no norm',
      body: { ...DESIGN_TIMINGS, stages: [{ ...DESIGN_TIMINGS.stages[0], stage: 'offer' }] },
      path: 'stages.0.stage',
    },
    {
      label: 'an insufficient stay without its stage',
      body: { ...DESIGN_TIMINGS, stages: [{ ...FINAL_WITH_FOUR_STAYS, stage: undefined }] },
      path: 'stages.0.stage',
    },
    {
      label: 'a negative response time',
      body: { ...DESIGN_TIMINGS, responseTime: { status: 'ok', hours: -1, samples: 5 } },
      path: 'responseTime.hours',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(timingsResponseSchema.safeParse(body))).toEqual([path]);
  });
});
