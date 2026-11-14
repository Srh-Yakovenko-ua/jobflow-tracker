import { describe, expect, it } from 'vitest';

import { buildDesignMatchValidation } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import {
  type MatchValidationResponse,
  matchValidationResponseSchema,
} from './analytics-match-validation.js';

const DESIGN_MATCH_VALIDATION = buildDesignMatchValidation();

const TOO_FEW_INTERVIEWS = {
  scored: 3,
  unscored: 0,
  buckets: [],
  statistics: {
    status: 'insufficient_data',
    have: 0,
    need: 5,
    message: "Для висновку потрібно щонайменше 5 заявок, що дійшли до інтерв'ю, і 5, що не дійшли",
  },
} as const satisfies MatchValidationResponse;

describe('matchValidationResponseSchema', () => {
  it('accepts the design example where 75+ reaches interview 3,7 times as often', () => {
    expect(matchValidationResponseSchema.parse(DESIGN_MATCH_VALIDATION)).toEqual(
      DESIGN_MATCH_VALIDATION,
    );
  });

  it('carries the buckets and correlation the analytics design body returns', () => {
    expect({
      buckets: DESIGN_MATCH_VALIDATION.buckets.map((bucket) => bucket.bucket),
      statistics: DESIGN_MATCH_VALIDATION.statistics,
    }).toMatchObject({
      buckets: ['below_50', 'from_50_to_74', 'from_75'],
      statistics: { status: 'ok', correlation: 0.354, significant: true },
    });
  });

  it('accepts insufficient statistics with no interviews yet', () => {
    expect(matchValidationResponseSchema.parse(TOO_FEW_INTERVIEWS)).toEqual(TOO_FEW_INTERVIEWS);
  });

  it.for([
    {
      label: 'a bucket name outside the three',
      body: {
        ...DESIGN_MATCH_VALIDATION,
        buckets: DESIGN_MATCH_VALIDATION.buckets.map((bucket) => ({
          ...bucket,
          bucket: bucket.bucket === 'from_75' ? 'from_90' : bucket.bucket,
        })),
      },
      path: 'buckets.2.bucket',
    },
    {
      label: 'a correlation of 1.5',
      body: {
        ...DESIGN_MATCH_VALIDATION,
        statistics: { ...DESIGN_MATCH_VALIDATION.statistics, correlation: 1.5 },
      },
      path: 'statistics.correlation',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(matchValidationResponseSchema.safeParse(body))).toEqual([path]);
  });
});
