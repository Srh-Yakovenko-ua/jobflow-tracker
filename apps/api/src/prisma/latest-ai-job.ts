import type { AiJobStatus, JobStatus } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const LATEST_AI_JOB_SELECT = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: { id: true, status: true },
} satisfies Prisma.AiJobFindManyArgs;

export const AI_RESULT_JOB_SELECT = {
  id: true,
  status: true,
  errorType: true,
  finishedAt: true,
  aiResult: { select: { output: true } },
} satisfies Prisma.AiJobSelect;

const UNSETTLED_AI_JOB_STATUSES: AiJobStatus[] = ['queued', 'processing'];

export const UNSETTLED_AI_JOB_WHERE = {
  status: { in: UNSETTLED_AI_JOB_STATUSES },
} satisfies Prisma.AiJobWhereInput;

export const UNSETTLED_FAILURE_WHERE = {
  status: 'failed',
  failureSettledAt: null,
  errorType: { not: null },
} satisfies Prisma.AiJobWhereInput;

export type FailedAiJobChange = {
  errorType: NonNullable<JobStatus['errorType']>;
  now: Date;
  settledAt?: Date;
};

export const failedAiJobChange = ({ errorType, now, settledAt }: FailedAiJobChange) =>
  ({
    status: 'failed',
    errorType,
    finishedAt: now,
    failureSettledAt: settledAt ?? null,
  }) satisfies Prisma.AiJobUpdateManyMutationInput;
