import { ACTIVE_STAGES, INTERVIEW_STAGES, type Stage } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { EFFECTIVE_STAGE_EVENT_AS_E_SQL } from '../../prisma/effective-stage-events.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { NewStageEvent } from './stage-transition.repository.js';

export type OpenApplication = { id: string; currentStage: Stage };

export type InSearch = InTransaction & { searchId: string };

export type WithdrawalEvent = NewStageEvent & { applicationId: string };

export type Withdrawal = InTransaction & {
  events: readonly WithdrawalEvent[];
  lastEventAt: Date;
};

export type SearchMove = InTransaction & {
  ids: readonly string[];
  fromSearchId: string;
  toSearchId: string;
};

export type SearchTotalsRow = {
  searchId: string;
  applications: number;
  interviews: number;
  offers: number;
  firstOfferAt: Date | null;
};

@Injectable()
export class SearchApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  lockOpen(userId: string, { searchId, tx = this.prisma }: InSearch): Promise<OpenApplication[]> {
    return tx.$queryRaw<OpenApplication[]>`
      SELECT id, current_stage AS "currentStage" FROM applications
      WHERE user_id = ${userId}::uuid AND search_id = ${searchId}::uuid AND deleted_at IS NULL
        AND current_stage = ANY(${[...ACTIVE_STAGES]}::stage[])
      ORDER BY id
      FOR UPDATE`;
  }

  async withdraw(
    userId: string,
    { events, lastEventAt, tx = this.prisma }: Withdrawal,
  ): Promise<number> {
    await tx.stageEvent.createMany({ data: [...events] });
    const { count } = await tx.application.updateMany({
      where: {
        id: { in: events.map(({ applicationId }) => applicationId) },
        userId,
        currentStage: { in: [...ACTIVE_STAGES] },
      },
      data: { currentStage: 'withdrawn', lastEventAt },
    });
    return count;
  }

  async moveTo(
    userId: string,
    { ids, fromSearchId, toSearchId, tx = this.prisma }: SearchMove,
  ): Promise<number> {
    const { count } = await tx.application.updateMany({
      where: { id: { in: [...ids] }, userId, searchId: fromSearchId },
      data: { searchId: toSearchId },
    });
    return count;
  }

  totalsOf(userId: string, searchIds: readonly string[]): Promise<SearchTotalsRow[]> {
    return this.prisma.$queryRaw<SearchTotalsRow[]>`
      SELECT a.search_id AS "searchId",
        count(DISTINCT a.id)::int AS applications,
        (count(DISTINCT a.id) FILTER (
          WHERE e.to_stage = ANY(${[...INTERVIEW_STAGES]}::stage[])
        ))::int AS interviews,
        (count(DISTINCT a.id) FILTER (WHERE e.to_stage = 'offer'))::int AS offers,
        min(e.occurred_at) FILTER (
          WHERE e.to_stage = 'offer' AND e.occurred_at >= s.started_at
        ) AS "firstOfferAt"
      FROM applications a
      JOIN searches s ON s.id = a.search_id
      LEFT JOIN stage_events e ON e.application_id = a.id AND ${EFFECTIVE_STAGE_EVENT_AS_E_SQL}
      WHERE a.user_id = ${userId}::uuid
        AND a.search_id = ANY(${[...searchIds]}::uuid[])
        AND a.is_draft = false
        AND a.deleted_at IS NULL
      GROUP BY a.search_id`;
  }
}
