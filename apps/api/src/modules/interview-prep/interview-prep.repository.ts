import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { AI_RESULT_JOB_SELECT, LATEST_AI_JOB_SELECT } from '../../prisma/latest-ai-job.js';
import { lockWithRunningAiJob } from '../../prisma/lock-owned-application.js';
import { nextPlannedEventSelect } from '../../prisma/next-planned-event.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  type InterviewPrepRequested,
  interviewPrepRequestedEvent,
} from './interview-prep.events.js';

const interviewPrepSourceSelect = (now: Date) =>
  ({
    company: true,
    position: true,
    stack: true,
    aiParsed: true,
    scheduledEvents: nextPlannedEventSelect(now),
  }) satisfies Prisma.ApplicationSelect;

const latestInterviewPrepSelect = (userId: string) =>
  ({
    aiJobs: {
      where: { userId, kind: 'interview_prep' },
      ...LATEST_AI_JOB_SELECT,
      select: AI_RESULT_JOB_SELECT,
    },
  }) satisfies Prisma.ApplicationSelect;

export type InterviewPrepSourceRow = Prisma.ApplicationGetPayload<{
  select: ReturnType<typeof interviewPrepSourceSelect>;
}>;

export type LatestInterviewPrepRow = Prisma.ApplicationGetPayload<{
  select: ReturnType<typeof latestInterviewPrepSelect>;
}>;

export type InterviewPrepSourceQuery = { applicationId: string; now: Date };

export type InterviewPrepLock = InTransaction & { applicationId: string };

export type RecordInterviewPrepRequested = InTransaction & { requested: InterviewPrepRequested };

@Injectable()
export class InterviewPrepRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSource(
    userId: string,
    { applicationId, now }: InterviewPrepSourceQuery,
  ): Promise<InterviewPrepSourceRow | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: interviewPrepSourceSelect(now),
    });
  }

  findLatest(userId: string, applicationId: string): Promise<LatestInterviewPrepRow | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: latestInterviewPrepSelect(userId),
    });
  }

  lockApplication(userId: string, { applicationId, tx = this.prisma }: InterviewPrepLock) {
    return lockWithRunningAiJob(tx, { userId, applicationId, kind: 'interview_prep' });
  }

  async recordRequested(
    userId: string,
    { requested, tx = this.prisma }: RecordInterviewPrepRequested,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: interviewPrepRequestedEvent(userId, requested),
      select: { id: true },
    });
  }
}
