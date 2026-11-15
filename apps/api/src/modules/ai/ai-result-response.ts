import type { JobStatus } from '@jobflow/shared';
import type { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import type { AI_RESULT_JOB_SELECT } from '../../prisma/latest-ai-job.js';

type AiResultJob = Pick<JobStatus, 'id' | 'status' | 'errorType'>;

export type StoredAiResultJob = Prisma.AiJobGetPayload<{ select: typeof AI_RESULT_JOB_SELECT }>;

export type AiResultResponse<O> = {
  result: (O & { generatedAt: string }) | null;
  job: AiResultJob | null;
};

export function aiResultResponse<O>(
  latest: StoredAiResultJob | undefined,
  schema: z.ZodType<O>,
): AiResultResponse<O> {
  if (latest === undefined) {
    return { result: null, job: null };
  }
  const { id, status, errorType, finishedAt, aiResult } = latest;
  const job = { id, status, errorType };
  if (status !== 'done' || finishedAt === null || aiResult === null) {
    return { result: null, job };
  }
  return {
    result: { ...schema.parse(aiResult.output), generatedAt: finishedAt.toISOString() },
    job,
  };
}
