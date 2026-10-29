import type { TimelineRecord } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { EFFECTIVE_STAGE_EVENTS } from '../../prisma/effective-stage-events.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const TIMELINE_SELECT = {
  stageEvents: {
    ...EFFECTIVE_STAGE_EVENTS,
    select: {
      id: true,
      fromStage: true,
      toStage: true,
      reasonCode: true,
      comment: true,
      occurredAt: true,
    },
  },
  timelineEvents: {
    where: { kind: { not: 'note_added' } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    select: { id: true, kind: true, payload: true, occurredAt: true },
  },
  notes: { select: { id: true, body: true, createdAt: true } },
} satisfies Prisma.ApplicationSelect;

export type TimelineRows = Prisma.ApplicationGetPayload<{ select: typeof TIMELINE_SELECT }>;

export type TimelineOfApplication = { applicationId: string };

export type TimelineWrite = TimelineOfApplication & {
  occurredAt: Date;
  tx?: Prisma.TransactionClient;
};

export type InsertTimelineEvent = TimelineWrite & { record: TimelineRecord };

@Injectable()
export class TimelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTimeline(
    userId: string,
    { applicationId }: TimelineOfApplication,
  ): Promise<TimelineRows | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: TIMELINE_SELECT,
    });
  }

  insert(
    userId: string,
    { applicationId, record, occurredAt, tx = this.prisma }: InsertTimelineEvent,
  ): Promise<number> {
    return tx.$executeRaw`
      INSERT INTO timeline_events (application_id, kind, payload, occurred_at)
      SELECT id, ${record.kind}::timeline_event_kind, ${JSON.stringify(record.payload)}::jsonb,
        ${occurredAt.toISOString()}::timestamptz
      FROM applications
      WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL`;
  }
}
