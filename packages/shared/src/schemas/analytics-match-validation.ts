import { z } from 'zod';

import {
  countSchema,
  fractionSchema,
  insufficientDataSchema,
  rateResultSchema,
} from './analytics-funnel.js';

export const MATCH_SCORE_BUCKETS = ['below_50', 'from_50_to_74', 'from_75'] as const;

export const scoreBucketSchema = z.object({
  bucket: z.enum(MATCH_SCORE_BUCKETS),
  applications: countSchema,
  screening: rateResultSchema,
  interview: rateResultSchema,
});

export const scoreRegressionSchema = z.object({
  slope: z.number(),
  low: z.number(),
  high: z.number(),
});

export const matchStatisticsSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    applications: countSchema,
    correlation: z.number().min(-1).max(1),
    pValue: fractionSchema,
    regression: scoreRegressionSchema.nullable(),
    significant: z.boolean(),
    message: z.string(),
  }),
  insufficientDataSchema,
]);

export const matchValidationResponseSchema = z.object({
  scored: countSchema,
  unscored: countSchema,
  buckets: z.array(scoreBucketSchema),
  statistics: matchStatisticsSchema,
});

export type MatchScoreBucket = z.infer<typeof scoreBucketSchema>['bucket'];
export type ScoreBucket = z.infer<typeof scoreBucketSchema>;
export type ScoreRegression = z.infer<typeof scoreRegressionSchema>;
export type MatchStatistics = z.infer<typeof matchStatisticsSchema>;
export type MatchValidationResponse = z.infer<typeof matchValidationResponseSchema>;
