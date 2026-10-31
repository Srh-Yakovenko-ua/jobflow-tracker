import { aiKindSchema } from '@jobflow/shared';
import { z } from 'zod';

export const AI_JOBS = { complete: 'ai.complete' } as const;

export const aiCompleteJobSchema = z.object({
  kind: aiKindSchema,
  input: z.unknown(),
  requestId: z.string().min(1).optional(),
});

export type AiCompleteJob = z.infer<typeof aiCompleteJobSchema>;
