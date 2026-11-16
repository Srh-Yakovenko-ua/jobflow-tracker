import { INTERVIEW_STAGES, type RhythmWeekCounts } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { EFFECTIVE_STAGE_EVENT_AS_E_SQL } from '../../prisma/effective-stage-events.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { USER_SETTINGS_SELECT, type UserSettingsRow } from '../../prisma/user-settings-row.js';
import { type RhythmWeekClosed, rhythmWeekClosedEvent } from './rhythm.events.js';

export type RhythmCountKind = keyof RhythmWeekCounts;

export type RhythmEventRow = { kind: RhythmCountKind; occurredAt: Date };

export type UpdateSuggestion = InTransaction & { goal: number | null };

export type RecordWeekClosed = InTransaction & { closed: RhythmWeekClosed };

@Injectable()
export class RhythmRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSettings(userId: string): Promise<UserSettingsRow | null> {
    return this.prisma.userSettings.findUnique({ where: { userId }, select: USER_SETTINGS_SELECT });
  }

  async findActiveSearchId(userId: string): Promise<string | null> {
    const search = await this.prisma.search.findFirst({
      where: { userId, status: 'active' },
      select: { id: true },
    });
    return search?.id ?? null;
  }

  stageEventsSince(userId: string, since: Date): Promise<RhythmEventRow[]> {
    return this.prisma.$queryRaw<RhythmEventRow[]>`
      SELECT CASE
          WHEN e.from_stage IS NULL THEN 'applications'
          WHEN e.to_stage = 'offer' THEN 'offers'
          ELSE 'interviews'
        END AS kind,
        e.occurred_at AS "occurredAt"
      FROM stage_events e
      JOIN applications a ON a.id = e.application_id
      WHERE a.user_id = ${userId}::uuid
        AND a.deleted_at IS NULL
        AND a.is_draft = false
        AND e.occurred_at >= ${since}
        AND ${EFFECTIVE_STAGE_EVENT_AS_E_SQL}
        AND (e.from_stage IS NULL
          OR e.to_stage = ANY(${[...INTERVIEW_STAGES, 'offer']}::stage[]))`;
  }

  async updateSuggestion(
    userId: string,
    { goal, tx = this.prisma }: UpdateSuggestion,
  ): Promise<void> {
    await tx.userSettings.updateMany({ where: { userId }, data: { suggestedWeeklyGoal: goal } });
  }

  async recordWeekClosed(
    userId: string,
    { closed, tx = this.prisma }: RecordWeekClosed,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: rhythmWeekClosedEvent(userId, closed),
      select: { id: true },
    });
  }
}
