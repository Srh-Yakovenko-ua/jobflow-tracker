import { z } from 'zod';

export const AI_JOB_STATUSES = ['queued', 'processing', 'done', 'failed'] as const;

export const aiJobStatusSchema = z.enum(AI_JOB_STATUSES);

export type AiJobStatus = z.infer<typeof aiJobStatusSchema>;

export const AI_JOB_STEPS = { queued: 1, processing: 2, done: 3, total: 3 } as const;

export const AI_JOB_FAILURES = {
  budgetExceeded: 'budget_exceeded',
  timeout: 'ai_timeout',
  notReady: 'not_ready',
  providerError: 'ai_provider_error',
  rateLimited: 'rate_limited',
} as const;

export const AI_RESULT_STATUSES = ['succeeded', 'failed'] as const;

export const aiResultStatusSchema = z.enum(AI_RESULT_STATUSES);

export type AiResultStatus = z.infer<typeof aiResultStatusSchema>;
