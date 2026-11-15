import type { Prisma } from '../generated/prisma/client.js';

export const nextPlannedEventSelect = (now: Date) =>
  ({
    where: { status: 'planned', startsAt: { gte: now } },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 1,
    select: { kind: true, startsAt: true },
  }) satisfies Prisma.ScheduledEventFindManyArgs;
