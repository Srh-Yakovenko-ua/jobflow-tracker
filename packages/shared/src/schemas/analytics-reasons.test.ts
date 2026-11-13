import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  reasonsQuerySchema,
  type ReasonsResponse,
  reasonsResponseSchema,
} from './analytics-reasons.js';

const BELOW_FIRST_CONCLUSION = {
  status: 'insufficient_data',
  have: 4,
  need: 1,
  message: 'Ще 1 відгук до першого висновку',
} as const;

const TECH_INTERVIEW_TOP = {
  status: 'ok',
  stage: 'tech_interview',
  code: 'skills_gap',
  count: 3,
  of: 4,
} as const;

const TECH_INTERVIEW = {
  stage: 'tech_interview',
  total: 4,
  stated: 4,
  sides: {
    company: { count: 4, share: BELOW_FIRST_CONCLUSION },
    candidate: { count: 0, share: BELOW_FIRST_CONCLUSION },
  },
  reasons: [
    { code: 'skills_gap', count: 3, share: BELOW_FIRST_CONCLUSION },
    { code: 'english_level', count: 1, share: BELOW_FIRST_CONCLUSION },
  ],
  unstated: [],
  top: TECH_INTERVIEW_TOP,
  trend: { previous: 'skills_gap', changed: false },
} as const satisfies ReasonsResponse['stages'][number];

const FINAL = {
  stage: 'final',
  total: 2,
  stated: 1,
  sides: {
    company: {
      count: 1,
      share: {
        status: 'insufficient_data',
        have: 1,
        need: 4,
        message: 'Ще 4 відгуки до першого висновку',
      },
    },
    candidate: {
      count: 0,
      share: {
        status: 'insufficient_data',
        have: 1,
        need: 4,
        message: 'Ще 4 відгуки до першого висновку',
      },
    },
  },
  reasons: [
    {
      code: 'chose_other',
      count: 1,
      share: {
        status: 'insufficient_data',
        have: 1,
        need: 4,
        message: 'Ще 4 відгуки до першого висновку',
      },
    },
  ],
  unstated: [{ code: 'unspecified', count: 1 }],
  top: null,
  trend: null,
} as const satisfies ReasonsResponse['stages'][number];

const DESIGN_REASONS = {
  stages: [TECH_INTERVIEW, FINAL],
  headline: TECH_INTERVIEW_TOP,
} as const satisfies ReasonsResponse;

describe('reasonsQuerySchema', () => {
  it('accepts a query without a search or a stage', () => {
    expect(reasonsQuerySchema.parse({})).toEqual({});
  });

  it.for([
    { label: 'an unknown stage', query: { stage: 'hired' }, path: 'stage' },
    { label: 'a search id that is not a uuid', query: { searchId: '42' }, path: 'searchId' },
  ])('refuses $label at $path', ({ query, path }) => {
    expect(issuePathsOf(reasonsQuerySchema.safeParse(query))).toEqual([path]);
  });
});

describe('reasonsResponseSchema', () => {
  it('accepts the design example where 3 of 4 tech interview rejections are a skills gap', () => {
    expect(reasonsResponseSchema.parse(DESIGN_REASONS)).toEqual(DESIGN_REASONS);
  });

  it('accepts a search too small to claim a top reason', () => {
    const small = {
      stages: [
        { ...TECH_INTERVIEW, top: { ...BELOW_FIRST_CONCLUSION, have: 7, need: 3 }, trend: null },
      ],
      headline: null,
    };
    expect(reasonsResponseSchema.parse(small)).toEqual(small);
  });

  it.for([
    {
      label: 'a top reason counting more rejections than it is out of',
      body: { ...DESIGN_REASONS, headline: { ...TECH_INTERVIEW_TOP, count: 5 } },
      path: 'headline.count',
    },
    {
      label: 'an unknown reason code',
      body: {
        ...DESIGN_REASONS,
        stages: [{ ...TECH_INTERVIEW, unstated: [{ code: 'ghosted', count: 1 }] }],
      },
      path: 'stages.0.unstated.0.code',
    },
    {
      label: 'an unknown stage',
      body: { ...DESIGN_REASONS, stages: [{ ...TECH_INTERVIEW, stage: 'hired' }] },
      path: 'stages.0.stage',
    },
    {
      label: 'a system side among the shares',
      body: {
        ...DESIGN_REASONS,
        stages: [
          {
            ...TECH_INTERVIEW,
            sides: { ...TECH_INTERVIEW.sides, system: { count: 0, share: BELOW_FIRST_CONCLUSION } },
          },
        ],
      },
      path: 'stages.0.sides',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(reasonsResponseSchema.safeParse(body))).toEqual([path]);
  });
});
