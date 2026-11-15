import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { LATEST_AI_JOB_SELECT } from '../../prisma/latest-ai-job.js';
import { lockWithRunningAiJob } from '../../prisma/lock-owned-application.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type CvHintsRequested, cvHintsRequestedEvent } from './cv-hints.events.js';

const CV_HINTS_SOURCE_SELECT = {
  position: true,
  resumeVersionId: true,
  resumeVersion: { select: { aiProfile: true } },
} satisfies Prisma.ApplicationSelect;

const LATEST_CV_HINTS_SELECT = {
  id: true,
  status: true,
  errorType: true,
  finishedAt: true,
  aiResult: { select: { output: true } },
} satisfies Prisma.AiJobSelect;

export type CvHintsSourceRow = Prisma.ApplicationGetPayload<{
  select: typeof CV_HINTS_SOURCE_SELECT;
}>;

export type LatestCvHintsJob = Prisma.AiJobGetPayload<{ select: typeof LATEST_CV_HINTS_SELECT }>;

export type CvHintsQuery = { applicationId: string; resumeVersionId: string; since: Date };

export type CvHintsLock = InTransaction & { applicationId: string };

export type RecordCvHintsRequested = InTransaction & { requested: CvHintsRequested };

@Injectable()
export class CvHintsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfile(userId: string, applicationId: string): Promise<CvHintsSourceRow | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: CV_HINTS_SOURCE_SELECT,
    });
  }

  lockApplication(userId: string, { applicationId, tx = this.prisma }: CvHintsLock) {
    return lockWithRunningAiJob(tx, { userId, applicationId, kind: 'cv_hints' });
  }

  async recordRequested(
    userId: string,
    { requested, tx = this.prisma }: RecordCvHintsRequested,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: cvHintsRequestedEvent(userId, requested),
      select: { id: true },
    });
  }

  findLatest(
    userId: string,
    { applicationId, resumeVersionId, since }: CvHintsQuery,
  ): Promise<LatestCvHintsJob | null> {
    return this.prisma.aiJob.findFirst({
      where: {
        userId,
        applicationId,
        resumeVersionId,
        kind: 'cv_hints',
        createdAt: { gte: since },
      },
      orderBy: LATEST_AI_JOB_SELECT.orderBy,
      select: LATEST_CV_HINTS_SELECT,
    });
  }
}
