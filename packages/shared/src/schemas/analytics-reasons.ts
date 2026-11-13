import { z } from 'zod';

import { rejectionReasonCodeSchema, rejectionSideSchema } from '../rejection-reasons.js';
import { stageSchema } from '../stages.js';
import { countSchema, insufficientDataSchema, rateResultSchema } from './analytics-funnel.js';
import { reasonCountSchema } from './rejection-reasons-summary.js';

const statedSideSchema = rejectionSideSchema.exclude(['system']);

export const reasonsQuerySchema = z.object({
  searchId: z.uuid().optional(),
  stage: stageSchema.optional(),
});

const reasonShareSchema = reasonCountSchema.extend({ share: rateResultSchema });

const sideShareSchema = z.object({ count: countSchema, share: rateResultSchema });

const okTopReasonSchema = z
  .object({
    status: z.literal('ok'),
    stage: stageSchema,
    code: rejectionReasonCodeSchema,
    count: z.int().positive(),
    of: z.int().positive(),
  })
  .refine((top) => top.count <= top.of, {
    path: ['count'],
    message: 'Top reason count exceeds its rejections',
  });

export const topReasonSchema = z.discriminatedUnion('status', [
  okTopReasonSchema,
  insufficientDataSchema,
]);

export const reasonsTrendSchema = z.object({
  previous: rejectionReasonCodeSchema.nullable(),
  changed: z.boolean(),
});

export const stageReasonsSchema = z.object({
  stage: stageSchema,
  total: countSchema,
  stated: countSchema,
  sides: z.record(statedSideSchema, sideShareSchema),
  reasons: z.array(reasonShareSchema),
  unstated: z.array(reasonCountSchema),
  top: topReasonSchema.nullable(),
  trend: reasonsTrendSchema.nullable(),
});

export const reasonsResponseSchema = z.object({
  stages: z.array(stageReasonsSchema),
  headline: topReasonSchema.nullable(),
});

export type ReasonsQuery = z.infer<typeof reasonsQuerySchema>;
export type TopReason = z.infer<typeof topReasonSchema>;
export type ReasonsTrend = z.infer<typeof reasonsTrendSchema>;
export type StageReasons = z.infer<typeof stageReasonsSchema>;
export type ReasonsResponse = z.infer<typeof reasonsResponseSchema>;
