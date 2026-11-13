import { ACTIVE_STAGES } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import {
  type FailedAiJobChange,
  failedAiJobChange,
  UNSETTLED_AI_JOB_WHERE,
} from '../prisma/latest-ai-job.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type StaleAiJobs = FailedAiJobChange & { createdBefore: Date };

export type MonthlySummaryCandidate = { userId: string; timezone: string };

const MONTHLY_SUMMARY_CANDIDATE_SELECT = {
  userId: true,
  timezone: true,
} satisfies Prisma.UserSettingsSelect;

const countOf = async (batch: Promise<Prisma.BatchPayload>) => (await batch).count;

const userIdsOf = async (rows: Promise<{ userId: string }[]>) =>
  (await rows).map(({ userId }) => userId);

@Injectable()
export class ScheduledJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  deleteIdempotencyKeysBefore(cutoff: Date): Promise<number> {
    return countOf(this.prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } }));
  }

  deleteRefreshTokensExpiredBefore(now: Date): Promise<number> {
    return countOf(this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }));
  }

  deleteNotificationsBefore(cutoff: Date): Promise<number> {
    return countOf(
      this.prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoff }, type: { not: 'insight_unlocked' } },
      }),
    );
  }

  failStaleAiJobs({ createdBefore, ...failure }: StaleAiJobs): Promise<number> {
    return countOf(
      this.prisma.aiJob.updateMany({
        where: { ...UNSETTLED_AI_JOB_WHERE, createdAt: { lt: createdBefore } },
        data: failedAiJobChange(failure),
      }),
    );
  }

  monthlySummaryCandidates(): Promise<MonthlySummaryCandidate[]> {
    return this.prisma.userSettings.findMany({
      where: { monthlySummaryEnabled: true },
      select: MONTHLY_SUMMARY_CANDIDATE_SELECT,
    });
  }

  silenceScanUserIds(): Promise<string[]> {
    return userIdsOf(
      this.prisma.application.findMany({
        where: { deletedAt: null, isDraft: false, currentStage: { in: [...ACTIVE_STAGES] } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    );
  }

  dueInterviewUserIds(now: Date): Promise<string[]> {
    return userIdsOf(
      this.prisma.reminder.findMany({
        where: { type: 'interview_soon', status: 'pending', dueAt: { lte: now } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    );
  }
}
