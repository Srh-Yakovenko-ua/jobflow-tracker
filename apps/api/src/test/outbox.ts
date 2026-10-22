import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export function outboxRows(prisma: PrismaService, where: Prisma.OutboxEventWhereInput = {}) {
  return prisma.outboxEvent.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { aggregate: true, aggregateId: true, eventType: true, payload: true },
  });
}
