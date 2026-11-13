import { aiCompleteOptionsSchema, aiKindSchema } from '@jobflow/shared';
import type { Job, Queue } from 'bullmq';
import { z } from 'zod';

import { withinLimit } from '../../common/probe.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';

export const AI_JOBS = { complete: 'ai.complete' } as const;

export const aiCompleteJobSchema = z.object({
  aiJobId: z.uuid(),
  userId: z.uuid(),
  kind: aiKindSchema,
  input: z.unknown(),
  applicationId: z.uuid().optional(),
  resumeVersionId: z.uuid().optional(),
  requestId: z.string().min(1).optional(),
  options: aiCompleteOptionsSchema.optional(),
  fresh: z.literal(true).optional(),
});

export type AiCompleteJob = z.infer<typeof aiCompleteJobSchema>;

export function queueAiCompletion(queue: Queue, job: AiCompleteJob): Promise<Job> {
  const added = queue.add(AI_JOBS.complete, job, { jobId: job.aiJobId });
  return withinLimit(added, OUTBOX_LIMITS.publishTimeoutMs);
}
