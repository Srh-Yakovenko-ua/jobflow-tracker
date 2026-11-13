import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  funnelQuerySchema,
  type FunnelResponse,
  funnelResponseSchema,
} from './analytics-funnel.js';

const DESIGN_FUNNEL = {
  stages: [
    {
      stage: 'applied',
      reached: 54,
      passed: 17,
      conversion: {
        status: 'ok',
        value: 0.425,
        low: 0.28509392559950375,
        high: 0.5780493145800892,
        successes: 17,
        trials: 40,
      },
      dropOff: { rejected: 21, ghosted: 14, withdrawn: 2 },
    },
    {
      stage: 'screening',
      reached: 17,
      passed: 9,
      conversion: {
        status: 'ok',
        value: 0.6,
        low: 0.3574683012062461,
        high: 0.8017550385865843,
        successes: 9,
        trials: 15,
      },
      dropOff: { rejected: 5, ghosted: 2, withdrawn: 1 },
    },
    {
      stage: 'tech_interview',
      reached: 9,
      passed: 4,
      conversion: {
        status: 'ok',
        value: 0.5,
        low: 0.21521606221387765,
        high: 0.7847839377861223,
        successes: 4,
        trials: 8,
      },
      dropOff: { rejected: 4, ghosted: 1, withdrawn: 0 },
    },
    {
      stage: 'final',
      reached: 4,
      passed: 1,
      conversion: {
        status: 'insufficient_data',
        have: 4,
        need: 1,
        message: 'Ще 1 відгук до першого висновку',
      },
      dropOff: { rejected: 2, ghosted: 0, withdrawn: 1 },
    },
    {
      stage: 'offer',
      reached: 1,
      passed: null,
      conversion: null,
      dropOff: { rejected: 0, ghosted: 0, withdrawn: 0 },
    },
  ],
  kpis: {
    sent: { total: 54, thisMonth: 19, previousMonth: 15 },
    interviews: { total: 9, thisMonth: 5, previousMonth: 3 },
    offers: { total: 1, thisMonth: 1, previousMonth: 0 },
    daysInSearch: 84,
  },
  mostExpensive: {
    status: 'ok',
    stage: 'tech_interview',
    reached: 9,
    passed: 4,
    lost: 5,
    investedDaysMedian: 17,
  },
} as const satisfies FunnelResponse;

const [APPLIED] = DESIGN_FUNNEL.stages;

describe('funnelQuerySchema', () => {
  it.for([
    { label: 'a missing search id', query: {} },
    { label: 'a search id that is not a uuid', query: { searchId: '42' } },
  ])('refuses $label at searchId', ({ query }) => {
    expect(issuePathsOf(funnelQuerySchema.safeParse(query))).toEqual(['searchId']);
  });
});

describe('funnelResponseSchema', () => {
  it('accepts the funnel of the 54 design applications', () => {
    expect(funnelResponseSchema.parse(DESIGN_FUNNEL)).toEqual(DESIGN_FUNNEL);
  });

  it('accepts a search too small to name the most expensive stage', () => {
    const small = {
      ...DESIGN_FUNNEL,
      mostExpensive: {
        status: 'insufficient_data',
        have: 7,
        need: 3,
        message: 'Ще 3 відгуки до першого висновку',
      },
    };
    expect(funnelResponseSchema.parse(small)).toEqual(small);
  });

  it.for([
    {
      label: 'a drop-off without ghosted',
      body: {
        ...DESIGN_FUNNEL,
        stages: [{ ...APPLIED, dropOff: { rejected: 21, withdrawn: 2 } }],
      },
      path: 'stages.0.dropOff.ghosted',
    },
    {
      label: 'a conversion above 1',
      body: {
        ...DESIGN_FUNNEL,
        stages: [{ ...APPLIED, conversion: { ...APPLIED.conversion, high: 1.2 } }],
      },
      path: 'stages.0.conversion.high',
    },
    {
      label: 'a negative reached count',
      body: { ...DESIGN_FUNNEL, stages: [{ ...APPLIED, reached: -1 }] },
      path: 'stages.0.reached',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(funnelResponseSchema.safeParse(body))).toEqual([path]);
  });
});
