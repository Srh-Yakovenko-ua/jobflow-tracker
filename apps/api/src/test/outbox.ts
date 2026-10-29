import { randomUUID } from 'node:crypto';

import { withinLimit } from '../common/probe.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ApplicationEvent } from '../modules/applications/index.js';
import type { DomainEvent, DomainEventHandler } from '../outbox/domain-event-router.js';
import { OUTBOX_LIMITS, type OutboxRelayService } from '../outbox/outbox-relay.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export type NewOutboxRows = {
  count: number;
  eventType: ApplicationEvent['eventType'];
  publishedAt?: Date;
  createdAt?: Date;
};

export type RecordingHandler = {
  readonly events: DomainEvent[];
  readonly handle: DomainEventHandler;
};

export const RELAY_SETTLE_LIMIT_MS = OUTBOX_LIMITS.publishTimeoutMs + 1000;

const OUTBOX_ORDER = [
  { createdAt: 'asc' },
  { id: 'asc' },
] satisfies Prisma.OutboxEventOrderByWithRelationInput[];

export function outboxRows(prisma: PrismaService, where: Prisma.OutboxEventWhereInput = {}) {
  return prisma.outboxEvent.findMany({
    where,
    orderBy: OUTBOX_ORDER,
    select: { aggregate: true, aggregateId: true, eventType: true, payload: true },
  });
}

export function outboxPublication(prisma: PrismaService) {
  return prisma.outboxEvent.findMany({
    orderBy: OUTBOX_ORDER,
    select: { id: true, publishedAt: true },
  });
}

export async function unpublishedOutboxIds(prisma: PrismaService): Promise<string[]> {
  const rows = await outboxPublication(prisma);
  return rows.filter(({ publishedAt }) => publishedAt === null).map(({ id }) => id);
}

export async function createOutboxRows(
  prisma: PrismaService,
  { count, eventType, ...dates }: NewOutboxRows,
): Promise<void> {
  await prisma.outboxEvent.createMany({
    data: Array.from({ length: count }, () => {
      const applicationId = randomUUID();
      return {
        aggregate: 'application',
        aggregateId: applicationId,
        eventType,
        payload: { applicationId },
        ...dates,
      };
    }),
  });
}

export function recordingHandler(): RecordingHandler {
  const events: DomainEvent[] = [];
  return {
    events,
    handle: (event) => {
      events.push(event);
      return Promise.resolve();
    },
  };
}

export function relayWithinSettleLimit(relay: OutboxRelayService): Promise<number> {
  return withinLimit(relay.relay(), RELAY_SETTLE_LIMIT_MS);
}
