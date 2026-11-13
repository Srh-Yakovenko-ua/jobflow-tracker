import type { AiJobStatus, JobStatus } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const LATEST_AI_JOB_SELECT = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: { id: true, status: true },
} satisfies Prisma.AiJobFindManyArgs;

const UNSETTLED_AI_JOB_STATUSES: AiJobStatus[] = ['queued', 'processing'];

export const UNSETTLED_AI_JOB_WHERE = {
  status: { in: UNSETTLED_AI_JOB_STATUSES },
} satisfies Prisma.AiJobWhereInput;

export type FailedAiJobChange = { errorType: NonNullable<JobStatus['errorType']>; now: Date };

export const failedAiJobChange = ({ errorType, now }: FailedAiJobChange) =>
  ({ status: 'failed', errorType, finishedAt: now }) satisfies Prisma.AiJobUpdateManyMutationInput;
