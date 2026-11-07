import type { Prisma } from '../generated/prisma/client.js';

export const LATEST_AI_JOB_SELECT = {
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 1,
  select: { status: true },
} satisfies Prisma.AiJobFindManyArgs;
