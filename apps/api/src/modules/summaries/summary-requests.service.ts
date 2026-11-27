import {
  type AiJobAccepted,
  MONTHLY_SUMMARY_REFUSALS,
  userNow,
  type YearMonth,
} from '@jobflow/shared';
import { Injectable, Logger } from '@nestjs/common';
import { startOfMonth, subMonths } from 'date-fns';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { requestEach, type RequestTotals } from '../../common/request-each.js';
import { previousLocalMonthOf } from '../../common/year-month.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiService } from '../ai/index.js';
import { type SummaryRequested, summaryRequested } from './summaries.events.js';
import { SummariesRepository } from './summaries.repository.js';

type SummaryJobStart = Omit<SummaryRequested, 'aiJobId'> & { tx: Prisma.TransactionClient };

type SummaryPeriod = { month: YearMonth; from: Date; to: Date };

function endedMonthOf(timezone: string, now: Date): SummaryPeriod {
  const to = startOfMonth(userNow({ timezone }, now));
  return { month: previousLocalMonthOf(timezone, now), from: subMonths(to, 1), to };
}

@Injectable()
export class SummaryRequestsService {
  private readonly logger = new Logger(SummaryRequestsService.name);

  constructor(
    private readonly repository: SummariesRepository,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  request(userId: string, requestId: string): Promise<AiJobAccepted> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const { timezone, searchId, runningJobId } = await this.repository.findStart(userId, { tx });
      if (runningJobId !== null) {
        return { jobId: runningJobId };
      }
      if (searchId === null) {
        throw conflict(MONTHLY_SUMMARY_REFUSALS.noActiveSearch);
      }
      const { month, from, to } = endedMonthOf(timezone, now);
      if (!(await this.repository.hasActivityIn(userId, { searchId, from, to, tx }))) {
        throw conflict(MONTHLY_SUMMARY_REFUSALS.noActivity);
      }
      const jobId = await this.start(userId, { searchId, month, requestId, fresh: true, tx });
      return { jobId };
    });
  }

  requestScheduledFor(userIds: string[]): Promise<RequestTotals> {
    return requestEach(userIds, {
      request: (userId) => this.requestScheduled(userId),
      logger: this.logger,
      labels: { failed: 'scheduled summary failed', done: 'monthly summaries requested' },
    });
  }

  private requestScheduled(userId: string): Promise<boolean> {
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const { timezone, searchId } = await this.repository.findStart(userId, { tx });
      const { month, from, to } = endedMonthOf(timezone, now);
      if (
        searchId === null ||
        (await this.repository.hasJobSince(userId, { since: to, tx })) ||
        !(await this.repository.hasActivityIn(userId, { searchId, from, to, tx }))
      ) {
        return false;
      }
      await this.start(userId, { searchId, month, tx });
      return true;
    });
  }

  private async start(userId: string, { tx, ...requested }: SummaryJobStart): Promise<string> {
    const aiJobId = await this.ai.createJob(userId, {
      kind: 'monthly_summary',
      periodMonth: requested.month,
      tx,
    });
    await this.ai.recordRequested(userId, {
      event: summaryRequested,
      requested: { aiJobId, ...requested },
      tx,
    });
    return aiJobId;
  }
}
