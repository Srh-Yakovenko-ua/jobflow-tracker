import { z } from 'zod';

import { type RejectionReasonCode, rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { OUTCOME_STAGES, outcomeStageSchema, type Stage, stageSchema } from '../stages.js';
import { plainTextSchema } from './text.js';

export const STAGE_MOVE_LIMITS = { commentMaxLength: 1000, undoWindowMs: 10_000 } as const;

export const stageEventSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  fromStage: stageSchema.nullable(),
  toStage: stageSchema,
  reasonCode: rejectionReasonCodeSchema.nullable(),
  comment: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  compensatesEventId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

type StageReason = { toStage: Stage; reasonCode?: RejectionReasonCode | null | undefined };

export const reasonFitsStage = ({ toStage, reasonCode }: StageReason) =>
  reasonCode === undefined || reasonCode === null || outcomeStageSchema.safeParse(toStage).success;

export const REASON_STAGE_ISSUE = {
  error: `Only ${OUTCOME_STAGES.join(', ')} take a reason code`,
  path: ['reasonCode'],
};

export const moveApplicationInputSchema = z
  .object({
    fromStage: stageSchema,
    toStage: stageSchema,
    reasonCode: rejectionReasonCodeSchema.optional(),
    comment: plainTextSchema(STAGE_MOVE_LIMITS.commentMaxLength).optional(),
    occurredAt: z.iso.datetime().optional(),
  })
  .refine(reasonFitsStage, REASON_STAGE_ISSUE);

export type StageEvent = z.infer<typeof stageEventSchema>;
export type MoveApplicationInput = z.infer<typeof moveApplicationInputSchema>;
