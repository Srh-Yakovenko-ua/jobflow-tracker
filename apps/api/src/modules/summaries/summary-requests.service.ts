import { type CaptureRetryResponse, userNow } from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { startOfMonth } from 'date-fns';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { localMonthOf, shiftMonth } from '../../common/year-month.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/index.js';
import type { SummaryRequested } from './summaries.events.js';
import { SummariesRepository } from './summaries.repository.js';

type SummaryJobStart = Omit<SummaryRequested, 'aiJobId'> & { tx: Prisma.TransactionClient };

export type MonthlySummaryTotals = { picked: number; requested: number };

const NO_ACTIVE_SEARCH = 'No active search';

const summarizedMonthOf = (timezone: string, now: Date) =>
  shiftMonth(localMonthOf(timezone, now), -1);

@Injectable()
export class SummaryRequestsService {
  private readonly logger = new Logger(SummaryRequestsService.name);

  constructor(
    private readonly repository: SummariesRepository,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  request(userId: string, requestId: string): Promise<CaptureRetryResponse> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const { timezone, searchId, runningJobId } = await this.repository.findStart(userId, { tx });
      if (runningJobId !== null) {
        return { jobId: runningJobId };
      }
      if (searchId === null) {
        throw conflict(NO_ACTIVE_SEARCH);
      }
      const month = summarizedMonthOf(timezone, now);
      const jobId = await this.start(userId, { searchId, month, requestId, fresh: true, tx });
      return { jobId };
    });
  }

  async requestScheduledFor(userIds: string[]): Promise<MonthlySummaryTotals> {
    const totals = { picked: userIds.length, requested: 0 };
    for (const userId of userIds) {
      totals.requested += Number(await this.requestScheduled(userId));
    }
    this.logger.log(totals, 'monthly summaries requested');
    return totals;
  }

  private requestScheduled(userId: string): Promise<boolean> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const { timezone, searchId } = await this.repository.findStart(userId, { tx });
      const since = startOfMonth(userNow({ timezone }, now));
      if (searchId === null || (await this.repository.hasJobSince(userId, { since, tx }))) {
        return false;
      }
      await this.start(userId, { searchId, month: summarizedMonthOf(timezone, now), tx });
      return true;
    });
  }

  private async start(userId: string, { tx, ...requested }: SummaryJobStart): Promise<string> {
    const aiJobId = await this.ai.createJob(userId, { kind: 'monthly_summary', tx });
    await this.repository.recordRequested(userId, { requested: { aiJobId, ...requested }, tx });
    return aiJobId;
  }
}
