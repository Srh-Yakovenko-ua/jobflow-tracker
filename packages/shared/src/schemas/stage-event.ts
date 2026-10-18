import { z } from 'zod';

import { rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { stageSchema } from '../stages.js';

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

export type StageEvent = z.infer<typeof stageEventSchema>;
