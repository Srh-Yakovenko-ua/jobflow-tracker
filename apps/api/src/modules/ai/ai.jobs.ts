import { aiKindSchema } from '@jobflow/shared';
import { z } from 'zod';

export const AI_JOBS = { complete: 'ai.complete' } as const;

export const AI_JOB_ERRORS = { budgetExceeded: 'budget_exceeded' } as const;

export const aiCompleteJobSchema = z.object({
  aiJobId: z.uuid(),
  userId: z.uuid(),
  kind: aiKindSchema,
  input: z.unknown(),
  applicationId: z.uuid().optional(),
  requestId: z.string().min(1).optional(),
});

export type AiCompleteJob = z.infer<typeof aiCompleteJobSchema>;
