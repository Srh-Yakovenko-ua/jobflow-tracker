import { AI_JOB_STEPS, type AiKind, type YearMonth } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import {
  type FailedAiJobChange,
  failedAiJobChange,
  UNSETTLED_AI_JOB_WHERE,
  UNSETTLED_FAILURE_WHERE,
} from '../../prisma/latest-ai-job.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_BUDGET, type BudgetWindow } from './ai-budget.js';
import { type AiCallRecord, callRow } from './ai-call-row.js';
import { AI_QUEUE_ESTIMATE } from './ai-queue-estimate.js';
import { aiRequestedOutbox, type RecordAiRequested } from './ai-requested-event.js';
import {
  type AiResultKey,
  resultChange,
  resultRow,
  type SaveAiFailure,
  type SaveAiResult,
} from './ai-result-row.js';

const CACHED_RESULT_SELECT = { id: true, output: true } satisfies Prisma.AiResultSelect;

export const AI_JOB_SELECT = {
  id: true,
  kind: true,
  status: true,
  step: true,
  errorType: true,
  applicationId: true,
} satisfies Prisma.AiJobSelect;

export type AiJobRow = Prisma.AiJobGetPayload<{ select: typeof AI_JOB_SELECT }>;

export type CachedAiResult = { id: string; output: unknown };

export type AiJobChange = { id: string; now: Date };

export type FinishAiJob = AiJobChange & { aiResultId: string };

export type FailAiJob = AiJobChange & FailedAiJobChange;

export type AiJobFailure = Pick<FailAiJob, 'id' | 'errorType'>;

export type AiJobTarget =
  | { applicationId: string }
  | { resumeVersionId: string }
  | { applicationId: string; resumeVersionId: string };

export type CreateAiJob = InTransaction &
  (
    | ({ kind: Exclude<AiKind, 'monthly_summary'> } & AiJobTarget)
    | { kind: 'monthly_summary'; periodMonth: YearMonth }
  );

export type FailAiJobWithResult = { result: SaveAiFailure; job: FailAiJob };

export type BudgetUsage = { calls: number; tokens: number };

export type QueueSample = { ahead: number; latencies: number[] };

@Injectable()
export class AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createJob(
    userId: string,
    { kind, tx = this.prisma, ...target }: CreateAiJob,
  ): Promise<string> {
    const { id } = await tx.aiJob.create({
      data: { userId, kind, ...target, step: AI_JOB_STEPS.queued },
      select: { id: true },
    });
    return id;
  }

  async startJob(userId: string, { id, now }: AiJobChange): Promise<number> {
    const { count } = await this.prisma.aiJob.updateMany({
      where: { id, userId, ...UNSETTLED_AI_JOB_WHERE },
      data: { status: 'processing', step: AI_JOB_STEPS.processing, startedAt: now },
    });
    return count;
  }

  async finishJob(userId: string, { id, aiResultId, now }: FinishAiJob): Promise<number> {
    const { count } = await this.prisma.aiJob.updateMany({
      where: { id, userId, status: 'processing' },
      data: { status: 'done', step: AI_JOB_STEPS.done, aiResultId, finishedAt: now },
    });
    return count;
  }

  async failJob(
    userId: string,
    { id, tx = this.prisma, ...failure }: FailAiJob & InTransaction,
  ): Promise<number> {
    const { count } = await tx.aiJob.updateMany({
      where: { id, userId, ...UNSETTLED_AI_JOB_WHERE },
      data: failedAiJobChange(failure),
    });
    return count;
  }

  failJobWithResult(userId: string, { result, job }: FailAiJobWithResult): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await this.saveFailure(userId, { ...result, tx });
      return this.failJob(userId, { ...job, tx });
    });
  }

  findJob(userId: string, id: string): Promise<AiJobRow | null> {
    return this.prisma.aiJob.findFirst({ where: { id, userId }, select: AI_JOB_SELECT });
  }

  async findUnsettledFailure(userId: string, id: string): Promise<string | null> {
    const failed = await this.prisma.aiJob.findFirst({
      where: { id, userId, ...UNSETTLED_FAILURE_WHERE },
      select: { errorType: true },
    });
    return failed?.errorType ?? null;
  }

  async markFailureSettled(userId: string, { id, now }: AiJobChange): Promise<number> {
    const { count } = await this.prisma.aiJob.updateMany({
      where: { id, userId, ...UNSETTLED_FAILURE_WHERE },
      data: { failureSettledAt: now },
    });
    return count;
  }

  findCachedResult(
    userId: string,
    { kind, inputHash }: AiResultKey,
  ): Promise<CachedAiResult | null> {
    return this.prisma.aiResult.findFirst({
      where: { userId, kind, inputHash, status: 'succeeded' },
      select: CACHED_RESULT_SELECT,
    });
  }

  async saveResult(userId: string, result: SaveAiResult): Promise<string> {
    const { kind, inputHash } = result;
    const { id } = await this.prisma.aiResult.upsert({
      where: { userId_kind_inputHash: { userId, kind, inputHash } },
      create: resultRow(userId, result),
      update: resultChange(result),
      select: { id: true },
    });
    return id;
  }

  async saveFailure(userId: string, { tx = this.prisma, ...failure }: SaveAiFailure) {
    const { kind, inputHash } = failure;
    const failed: SaveAiResult = { ...failure, status: 'failed' };
    const { count } = await tx.aiResult.updateMany({
      where: { userId, kind, inputHash, status: 'failed' },
      data: resultChange(failed),
    });
    if (count === 0) {
      await tx.aiResult.createMany({
        data: [resultRow(userId, failed)],
        skipDuplicates: true,
      });
    }
  }

  async recordRequested(userId: string, { tx = this.prisma, ...row }: RecordAiRequested) {
    await tx.outboxEvent.create({ data: aiRequestedOutbox(userId, row), select: { id: true } });
  }

  async recordCall(userId: string, call: AiCallRecord): Promise<void> {
    await this.prisma.aiCall.create({ data: callRow(userId, call), select: { id: true } });
  }

  async budgetUsage(userId: string, { dayStart, monthStart }: BudgetWindow): Promise<BudgetUsage> {
    const [calls, { _sum: spent }] = await Promise.all([
      this.prisma.aiCall.count({
        where: {
          userId,
          createdAt: { gte: dayStart },
          OR: [{ status: 'succeeded' }, { errorType: { in: [...AI_BUDGET.countedFailures] } }],
        },
      }),
      this.prisma.aiCall.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { tokensIn: true, tokensOut: true },
      }),
    ]);
    return { calls, tokens: (spent.tokensIn ?? 0) + (spent.tokensOut ?? 0) };
  }

  async queueSample(userId: string, id: string): Promise<QueueSample | null> {
    const job = await this.prisma.aiJob.findFirst({
      where: { id, userId, status: 'queued' },
      select: { kind: true, createdAt: true },
    });
    if (job === null) {
      return null;
    }
    const [ahead, recent] = await Promise.all([
      this.prisma.aiJob.count({ where: { status: 'queued', createdAt: { lt: job.createdAt } } }),
      this.prisma.aiResult.findMany({
        where: { kind: job.kind, status: 'succeeded' },
        orderBy: { updatedAt: 'desc' },
        take: AI_QUEUE_ESTIMATE.sampleSize,
        select: { latencyMs: true },
      }),
    ]);
    return { ahead, latencies: recent.map((result) => result.latencyMs) };
  }

  async deleteResults(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.aiResult.deleteMany({ where: { userId } }),
      this.prisma.application.updateMany({
        where: {
          userId,
          OR: [{ matchScore: { not: null } }, { aiParsed: { not: Prisma.DbNull } }],
        },
        data: { matchScore: null, aiParsed: Prisma.DbNull },
      }),
      this.prisma.resumeVersion.updateMany({
        where: { userId, aiProfile: { not: Prisma.DbNull } },
        data: { aiProfile: Prisma.DbNull },
      }),
    ]);
  }
}
