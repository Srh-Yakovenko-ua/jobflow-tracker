import {
  monthlySummaryOutputSchema,
  type Plan,
  type Summary,
  type SummaryResponse,
  type YearMonth,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { localMonthOf, shiftMonth } from '../../common/year-month.js';
import { timeZoneOf } from '../../prisma/user-time-zone.js';
import { PlansService } from '../plans/index.js';
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

@Injectable()
export class SummariesService {
  constructor(
    private readonly repository: SummariesRepository,
    private readonly plans: PlansService,
  ) {}

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
