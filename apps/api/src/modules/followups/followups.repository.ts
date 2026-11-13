import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { LATEST_AI_JOB_SELECT, UNSETTLED_AI_JOB_WHERE } from '../../prisma/latest-ai-job.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type FollowupRequested, followupRequestedEvent } from './followups.events.js';

const followupSourceSelect = (now: Date) =>
  ({
    company: true,
    position: true,
    rawText: true,
    isDraft: true,
    currentStage: true,
    lastEventAt: true,
    contacts: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1, select: { name: true } },
    scheduledEvents: {
      where: { status: { not: 'cancelled' }, startsAt: { lte: now } },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
      take: 1,
      select: { kind: true, startsAt: true },
    },
    user: { select: { displayName: true, settings: { select: { timezone: true } } } },
  }) satisfies Prisma.ApplicationSelect;

const LATEST_DRAFT_SELECT = {
  finishedAt: true,
  aiResult: { select: { output: true } },
} satisfies Prisma.AiJobSelect;

const FOLLOWUP_JOB_SELECT = {
  ...LATEST_AI_JOB_SELECT,
  select: { ...LATEST_AI_JOB_SELECT.select, errorType: true },
} satisfies Prisma.AiJobFindManyArgs;

const RUNNING_FOLLOWUP = {
  kind: 'followup',
  ...UNSETTLED_AI_JOB_WHERE,
} satisfies Prisma.AiJobWhereInput;

export type FollowupSourceRow = Prisma.ApplicationGetPayload<{
  select: ReturnType<typeof followupSourceSelect>;
}>;

export type LatestFollowupDraft = Prisma.AiJobGetPayload<{ select: typeof LATEST_DRAFT_SELECT }>;

export type LatestFollowupJob = Prisma.AiJobGetPayload<{
  select: typeof FOLLOWUP_JOB_SELECT.select;
}>;

export type FollowupSourceQuery = { applicationId: string; now: Date };

export type FollowupLock = InTransaction & { applicationId: string };

export type LockedFollowup = { runningJobId: string | null };

export type RecordFollowupRequested = InTransaction & { requested: FollowupRequested };

@Injectable()
export class FollowupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSource(
    userId: string,
    { applicationId, now }: FollowupSourceQuery,
  ): Promise<FollowupSourceRow | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: followupSourceSelect(now),
    });
  }

  async lockApplication(
    userId: string,
    { applicationId, tx = this.prisma }: FollowupLock,
  ): Promise<LockedFollowup | null> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM applications
      WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    if (locked.length === 0) {
      return null;
    }
    const running = await tx.aiJob.findFirst({
      where: { userId, applicationId, ...RUNNING_FOLLOWUP },
      ...LATEST_AI_JOB_SELECT,
    });
    return { runningJobId: running?.id ?? null };
  }

  async recordRequested(
    userId: string,
    { requested, tx = this.prisma }: RecordFollowupRequested,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: followupRequestedEvent(userId, requested),
      select: { id: true },
    });
  }

  findLatestDraft(userId: string, applicationId: string): Promise<LatestFollowupDraft | null> {
    return this.prisma.aiJob.findFirst({
      where: { userId, applicationId, kind: 'followup', status: 'done', aiResultId: { not: null } },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      select: LATEST_DRAFT_SELECT,
    });
  }

  findLatestJob(userId: string, applicationId: string): Promise<LatestFollowupJob | null> {
    return this.prisma.aiJob.findFirst({
      where: { userId, applicationId, kind: 'followup' },
      ...FOLLOWUP_JOB_SELECT,
    });
  }
}
