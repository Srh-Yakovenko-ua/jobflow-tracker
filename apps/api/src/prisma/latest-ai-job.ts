import type { AiJobStatus } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';

export const LATEST_AI_JOB_SELECT = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: { id: true, status: true },
} satisfies Prisma.AiJobFindManyArgs;

export const UNSETTLED_AI_JOB_STATUSES: AiJobStatus[] = ['queued', 'processing'];
