import { describe, expect, it } from 'vitest';

import { buildDesignFunnel } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { funnelQuerySchema, funnelResponseSchema } from './analytics-funnel.js';

const DESIGN_FUNNEL = buildDesignFunnel();

const SEARCH_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0e30';

const [APPLIED] = DESIGN_FUNNEL.stages;

describe('funnelQuerySchema', () => {
  it.for([
    { label: 'a missing search id', query: {} },
    { label: 'a search id that is not a uuid', query: { searchId: '42' } },
  ])('refuses $label at searchId', ({ query }) => {
    expect(issuePathsOf(funnelQuerySchema.safeParse(query))).toEqual(['searchId']);
  });

  it('anchors the KPI counts on a summarized month', () => {
    expect(funnelQuerySchema.parse({ searchId: SEARCH_ID, month: '2026-08' })).toEqual({
      searchId: SEARCH_ID,
      month: '2026-08',
    });
  });

  it.for(['2026-13', '2026-8', 'abc', ''])('refuses the month %j', (month) => {
    expect(issuePathsOf(funnelQuerySchema.safeParse({ searchId: SEARCH_ID, month }))).toEqual([
      'month',
    ]);
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
        stages: [{ ...APPLIED, conversion: { ...APPLIED?.conversion, high: 1.2 } }],
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
