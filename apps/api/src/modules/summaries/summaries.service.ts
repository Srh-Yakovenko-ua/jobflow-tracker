import {
  monthlySummaryOutputSchema,
  type Plan,
  type Summary,
  SUMMARY_LIMITS,
  type SummaryArchive,
  type SummaryArchiveItem,
  type SummaryResponse,
  type YearMonth,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { subMonths } from 'date-fns';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { localMonthOf, shiftMonth } from '../../common/year-month.js';
import { timeZoneOf } from '../../prisma/user-time-zone.js';
import { planProgressOf, PlansService } from '../plans/index.js';
import { SummariesRepository, type SummaryJobRow } from './summaries.repository.js';

type SummaryView = { summary: Summary; aiResultId: string; planMonth: YearMonth };

const SUMMARY_NOT_FOUND = 'Summary not found';

function viewOf({ id, createdAt, finishedAt, user, aiResult }: SummaryJobRow): SummaryView | null {
  if (finishedAt === null || aiResult === null) {
    return null;
  }
  const { summary: text, actions } = monthlySummaryOutputSchema.parse(aiResult.output);
  const planMonth = localMonthOf(timeZoneOf(user.settings), createdAt);
  const summary = {
    aiJobId: id,
    month: shiftMonth(planMonth, -1),
    text,
    actions,
    generatedAt: finishedAt.toISOString(),
    planId: aiResult.plans[0]?.id ?? null,
  };
  return { summary, aiResultId: aiResult.id, planMonth };
}

const viewOrNull = (row: SummaryJobRow | null) => (row === null ? null : viewOf(row));

function newestPerMonth(rows: SummaryJobRow[]): SummaryArchiveItem[] {
  const byMonth = new Map<YearMonth, SummaryArchiveItem>();
  for (const row of rows) {
    const summary = viewOf(row)?.summary;
    if (summary !== undefined && !byMonth.has(summary.month)) {
      const plan = planProgressOf(row.aiResult?.plans[0]?.items ?? []);
      byMonth.set(summary.month, { ...summary, plan });
    }
  }
  return [...byMonth.values()];
}

@Injectable()
export class SummariesService {
  constructor(
    private readonly repository: SummariesRepository,
    private readonly plans: PlansService,
    private readonly clock: Clock,
  ) {}

  async archive(userId: string): Promise<SummaryArchive> {
    const since = subMonths(this.clock.now(), SUMMARY_LIMITS.archiveMonths + 1);
    const rows = await this.repository.findDoneSummariesSince(userId, since);
    return { items: newestPerMonth(rows).slice(0, SUMMARY_LIMITS.archiveMonths) };
  }

  async latest(userId: string): Promise<SummaryResponse> {
    const [row, job] = await Promise.all([
      this.repository.findLatestSummary(userId),
      this.repository.findLatestJob(userId),
    ]);
    return { summary: viewOrNull(row)?.summary ?? null, job };
  }

  async saveAsPlan(userId: string, aiJobId: string): Promise<Plan> {
    const view = viewOrNull(await this.repository.findSummary(userId, aiJobId));
    if (view === null) {
      throw notFound(SUMMARY_NOT_FOUND);
    }
    const { aiResultId, planMonth: month, summary } = view;
    return this.plans.createFromSummary(userId, { aiResultId, month, actions: summary.actions });
  }
}
