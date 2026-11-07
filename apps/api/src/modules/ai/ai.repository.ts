import type { AiKind, AiResultStatus } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_BUDGET } from './ai-budget.js';
import { AI_QUEUE_ESTIMATE } from './ai-queue-estimate.js';

const CACHED_RESULT_SELECT = { id: true, output: true } satisfies Prisma.AiResultSelect;

const COUNTED_RESULTS = [
  { status: 'succeeded' },
  { error: { in: [...AI_BUDGET.countedFailures] } },
] satisfies Prisma.AiResultWhereInput[];

export type CachedAiResult = { id: string; output: unknown };

export type AiJobChange = { id: string; now: Date };

export type FinishAiJob = AiJobChange & { aiResultId: string };

export type FailAiJob = AiJobChange & { errorType: string };

export type AiResultKey = { kind: AiKind; inputHash: string };

export type AiResultFields = AiResultKey & {
  error: string | null;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  now: Date;
};

export type SaveAiResult = AiResultFields & {
  status: AiResultStatus;
  output?: Prisma.InputJsonValue;
};

export type SaveAiFailure = AiResultFields;

export type BudgetWindow = { dayStart: Date; monthStart: Date };

export type BudgetUsage = { calls: number; tokens: number };

export type QueueSample = { ahead: number; latencies: number[] };

function resultRow(userId: string, { now, ...result }: SaveAiResult) {
  return { userId, ...result, updatedAt: now };
}

function resultChange({ now, tokensIn, tokensOut, ...result }: SaveAiResult) {
  return {
    ...result,
    updatedAt: now,
    tokensIn: { increment: tokensIn },
    tokensOut: { increment: tokensOut },
  };
}

@Injectable()
export class AiRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startJob(userId: string, { id, now }: AiJobChange): Promise<number> {
    const { count } = await this.prisma.aiJob.updateMany({
      where: { id, userId, status: { in: ['queued', 'processing'] } },
      data: { status: 'processing', startedAt: now },
    });
    return count;
  }

  async finishJob(userId: string, { id, aiResultId, now }: FinishAiJob): Promise<void> {
    await this.prisma.aiJob.updateMany({
      where: { id, userId, status: 'processing' },
      data: { status: 'done', aiResultId, finishedAt: now },
    });
  }

  async failJob(userId: string, { id, errorType, now }: FailAiJob): Promise<void> {
    await this.prisma.aiJob.updateMany({
      where: { id, userId, status: 'processing' },
      data: { status: 'failed', errorType, finishedAt: now },
    });
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

  async saveFailure(userId: string, failure: SaveAiFailure): Promise<void> {
    const { kind, inputHash } = failure;
    const failed: SaveAiResult = { ...failure, status: 'failed' };
    const { count } = await this.prisma.aiResult.updateMany({
      where: { userId, kind, inputHash, status: 'failed' },
      data: resultChange(failed),
    });
    if (count === 0) {
      await this.prisma.aiResult.createMany({
        data: [resultRow(userId, failed)],
        skipDuplicates: true,
      });
    }
  }

  async budgetUsage(userId: string, { dayStart, monthStart }: BudgetWindow): Promise<BudgetUsage> {
    const [calls, { _sum: spent }] = await Promise.all([
      this.prisma.aiResult.count({
        where: { userId, updatedAt: { gte: dayStart }, OR: COUNTED_RESULTS },
      }),
      this.prisma.aiResult.aggregate({
        where: { updatedAt: { gte: monthStart } },
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
