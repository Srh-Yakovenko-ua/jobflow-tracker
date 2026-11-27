import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { LATEST_AI_JOB_SELECT, UNSETTLED_AI_JOB_WHERE } from '../../prisma/latest-ai-job.js';
import { lockUser } from '../../prisma/lock-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { timeZoneOf } from '../../prisma/user-time-zone.js';

const SUMMARY_KIND = 'monthly_summary';

const DONE_SUMMARY_WHERE = {
  kind: SUMMARY_KIND,
  status: 'done',
  aiResultId: { not: null },
} satisfies Prisma.AiJobWhereInput;

const summaryJobSelect = (userId: string) =>
  ({
    id: true,
    periodMonth: true,
    createdAt: true,
    finishedAt: true,
    user: { select: { settings: { select: { timezone: true } } } },
    aiResult: {
      select: {
        id: true,
        output: true,
        plans: {
          where: { userId },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 1,
          select: { id: true, items: { select: { doneAt: true } } },
        },
      },
    },
  }) satisfies Prisma.AiJobSelect;

const summaryStartSelect = (userId: string) =>
  ({
    settings: { select: { timezone: true } },
    searches: { where: { userId, status: 'active' }, take: 1, select: { id: true } },
    aiJobs: {
      where: { userId, kind: SUMMARY_KIND, ...UNSETTLED_AI_JOB_WHERE },
      ...LATEST_AI_JOB_SELECT,
    },
  }) satisfies Prisma.UserSelect;

export type SummaryJobRow = Prisma.AiJobGetPayload<{
  select: ReturnType<typeof summaryJobSelect>;
}>;

export type LatestSummaryJob = Prisma.AiJobGetPayload<{
  select: typeof LATEST_AI_JOB_SELECT.select;
}>;

export type SummaryStart = {
  timezone: string;
  searchId: string | null;
  runningJobId: string | null;
};

export type SummaryJobsSince = Required<InTransaction> & { since: Date };

export type SearchActivityWindow = { searchId: string; from: Date; to: Date };

@Injectable()
export class SummariesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockUser(userId: string, { tx }: Required<InTransaction>): Promise<void> {
    await lockUser(tx, userId);
  }

  async findStart(userId: string, { tx }: Required<InTransaction>): Promise<SummaryStart> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: summaryStartSelect(userId),
    });
    return {
      timezone: timeZoneOf(user?.settings),
      searchId: user?.searches[0]?.id ?? null,
      runningJobId: user?.aiJobs[0]?.id ?? null,
    };
  }

  async hasJobSince(userId: string, { since, tx }: SummaryJobsSince): Promise<boolean> {
    const count = await tx.aiJob.count({
      where: { userId, kind: SUMMARY_KIND, createdAt: { gte: since } },
    });
    return count > 0;
  }

  async hasActivityIn(
    userId: string,
    { searchId, from, to, tx }: SearchActivityWindow & Required<InTransaction>,
  ): Promise<boolean> {
    const count = await tx.stageEvent.count({
      where: {
        occurredAt: { gte: from, lt: to },
        application: { userId, searchId, deletedAt: null, isDraft: false },
      },
    });
    return count > 0;
  }

  findLatestSummary(userId: string): Promise<SummaryJobRow | null> {
    return this.prisma.aiJob.findFirst({
      where: { userId, ...DONE_SUMMARY_WHERE },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: summaryJobSelect(userId),
    });
  }

  findDoneSummariesSince(userId: string, since: Date): Promise<SummaryJobRow[]> {
    return this.prisma.aiJob.findMany({
      where: { userId, ...DONE_SUMMARY_WHERE, createdAt: { gte: since } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: summaryJobSelect(userId),
    });
  }

  findSummary(userId: string, aiJobId: string): Promise<SummaryJobRow | null> {
    return this.prisma.aiJob.findFirst({
      where: { id: aiJobId, userId, ...DONE_SUMMARY_WHERE },
      select: summaryJobSelect(userId),
    });
  }

  findLatestJob(userId: string): Promise<LatestSummaryJob | null> {
    return this.prisma.aiJob.findFirst({
      where: { userId, kind: SUMMARY_KIND },
      ...LATEST_AI_JOB_SELECT,
    });
  }
}
