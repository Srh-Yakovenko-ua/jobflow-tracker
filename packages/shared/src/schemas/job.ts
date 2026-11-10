import { z } from 'zod';

import { AI_JOB_STEPS, aiJobStatusSchema } from '../ai-statuses.js';

export const jobStatusSchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: aiJobStatusSchema,
  step: z.int().min(0).max(AI_JOB_STEPS.total),
  totalSteps: z.literal(AI_JOB_STEPS.total),
  queue: z.object({ ahead: z.int().min(0), etaSeconds: z.int().min(0) }).nullable(),
  errorType: z.string().nullable(),
  applicationId: z.uuid().nullable(),
});

export const jobUpdatedSchema = jobStatusSchema.omit({ queue: true, totalSteps: true });

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobUpdated = z.infer<typeof jobUpdatedSchema>;
