import { z } from 'zod';

import { activeStageSchema } from '../stages.js';
import {
  countSchema,
  fractionSchema,
  insufficientDataSchema,
  rateResultSchema,
} from './analytics-funnel.js';
import { responseTimeSchema, sourcesQuerySchema } from './analytics-sources.js';

const durationSchema = z.number().nonnegative();

export const timingsQuerySchema = sourcesQuerySchema;

export const stageTimingSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    stage: activeStageSchema,
    medianDays: durationSchema,
    lowerQuartileDays: durationSchema,
    upperQuartileDays: durationSchema,
    samples: z.int().positive(),
  }),
  insufficientDataSchema.extend({ stage: activeStageSchema }),
]);

export const responseHoursSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), hours: durationSchema, samples: z.int().positive() }),
  insufficientDataSchema,
]);

export const marketBenchmarkSchema = z.object({
  low: fractionSchema,
  high: fractionSchema,
  source: z.string(),
  url: z.url(),
});

export const GAP_POSITIONS = ['below', 'within', 'above'] as const;

export const ghostRateVsMarketSchema = z.object({
  rate: rateResultSchema,
  market: marketBenchmarkSchema,
  gap: z.object({ position: z.enum(GAP_POSITIONS), points: countSchema }).nullable(),
});

export const timingsResponseSchema = z.object({
  stages: z.array(stageTimingSchema),
  responseTime: responseHoursSchema,
  medianDaysToOffer: responseTimeSchema,
  ghostRate: ghostRateVsMarketSchema,
});

export const normsResponseSchema = z.object({
  stageNormDays: z.record(activeStageSchema, countSchema.nullable()),
  medianDaysToOffer: countSchema.nullable(),
});

export type TimingsQuery = z.infer<typeof timingsQuerySchema>;
export type StageTiming = z.infer<typeof stageTimingSchema>;
export type ResponseHours = z.infer<typeof responseHoursSchema>;
export type MarketBenchmark = z.infer<typeof marketBenchmarkSchema>;
export type GhostRateVsMarket = z.infer<typeof ghostRateVsMarketSchema>;
export type TimingsResponse = z.infer<typeof timingsResponseSchema>;
export type NormsResponse = z.infer<typeof normsResponseSchema>;
