import type { Prisma } from '../generated/prisma/client.js';

export const EFFECTIVE_STAGE_EVENTS = {
  where: { compensatesEventId: null, compensatedBy: { is: null } },
  orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
} satisfies Prisma.Application$stageEventsArgs;
