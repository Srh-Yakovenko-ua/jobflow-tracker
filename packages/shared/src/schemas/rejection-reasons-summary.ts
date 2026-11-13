import { z } from 'zod';

import { rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { stageSchema } from '../stages.js';

export const rejectionReasonsSummaryQuerySchema = z.object({
  stage: stageSchema,
  searchId: z.uuid().optional(),
});

export const reasonCountSchema = z.object({
  code: rejectionReasonCodeSchema,
  count: z.int32().min(1),
});

export const rejectionReasonsSummarySchema = z.object({
  stage: stageSchema,
  total: z.int32().min(0),
  reasons: z.array(reasonCountSchema),
});

export type RejectionReasonsSummaryQuery = z.infer<typeof rejectionReasonsSummaryQuerySchema>;
export type RejectionReasonsSummary = z.infer<typeof rejectionReasonsSummarySchema>;
