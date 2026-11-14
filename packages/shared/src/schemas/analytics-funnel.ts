import { z } from 'zod';

import { outcomeStageSchema, stageSchema } from '../stages.js';
import { yearMonthSchema } from './year-month.js';

export const countSchema = z.int().nonnegative();

export const fractionSchema = z.number().min(0).max(1);

export const insufficientDataSchema = z.object({
  status: z.literal('insufficient_data'),
  have: countSchema,
  need: z.int().positive(),
  message: z.string(),
});

export const funnelQuerySchema = z.object({
  searchId: z.uuid(),
  month: yearMonthSchema.optional(),
});

export const rateResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    value: fractionSchema,
    low: fractionSchema,
    high: fractionSchema,
    successes: countSchema,
    trials: z.int().positive(),
  }),
  insufficientDataSchema,
]);

export const funnelStageSchema = z.object({
  stage: stageSchema,
  reached: countSchema,
  passed: countSchema.nullable(),
  conversion: rateResultSchema.nullable(),
  dropOff: z.record(outcomeStageSchema, countSchema),
});

const monthlyCountSchema = z.object({
  total: countSchema,
  thisMonth: countSchema,
  previousMonth: countSchema,
});

export const funnelKpisSchema = z.object({
  sent: monthlyCountSchema,
  interviews: monthlyCountSchema,
  offers: monthlyCountSchema,
  daysInSearch: countSchema,
});

export const mostExpensiveStageSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    stage: stageSchema,
    reached: countSchema,
    passed: countSchema,
    lost: z.int().positive(),
    investedDaysMedian: z.number().nonnegative(),
  }),
  insufficientDataSchema,
]);

export const funnelResponseSchema = z.object({
  stages: z.array(funnelStageSchema),
  kpis: funnelKpisSchema,
  mostExpensive: mostExpensiveStageSchema.nullable(),
});

export type FunnelQuery = z.infer<typeof funnelQuerySchema>;
export type RateResult = z.infer<typeof rateResultSchema>;
export type FunnelStage = z.infer<typeof funnelStageSchema>;
export type FunnelKpis = z.infer<typeof funnelKpisSchema>;
export type MostExpensiveStage = z.infer<typeof mostExpensiveStageSchema>;
export type FunnelResponse = z.infer<typeof funnelResponseSchema>;
