import type { AiKind, AiResultStatus } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AI_QUEUE_ESTIMATE } from './ai-budget.js';

const CACHED_RESULT_SELECT = { id: true, output: true } satisfies Prisma.AiResultSelect;

export type CachedAiResult = { id: string; output: unknown };

export type AiJobChange = { id: string; now: Date };

export type FinishAiJob = AiJobChange & { aiResultId: string };

export type FailAiJob = AiJobChange & { errorType: string };

export type AiResultKey = { kind: AiKind; inputHash: string };

export type SaveAiResult = AiResultKey & {
  status: AiResultStatus;
  output?: Prisma.InputJsonValue;
  error: string | null;
  model: string;
  promptVersion: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
};

export type BudgetWindow = { dayStart: Date; monthStart: Date };

export type BudgetUsage = { calls: number; tokens: number };

export type QueueSample = { ahead: number; latencies: number[] };

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

  async saveResult(
    userId: string,
    { tokensIn, tokensOut, ...result }: SaveAiResult,
  ): Promise<string> {
    const { kind, inputHash } = result;
    const { id } = await this.prisma.aiResult.upsert({
      where: { userId_kind_inputHash: { userId, kind, inputHash } },
      create: { userId, tokensIn, tokensOut, ...result },
      update: { ...result, tokensIn: { increment: tokensIn }, tokensOut: { increment: tokensOut } },
      select: { id: true },
    });
    return id;
  }

  async budgetUsage(userId: string, { dayStart, monthStart }: BudgetWindow): Promise<BudgetUsage> {
    const [calls, { _sum: spent }] = await Promise.all([
      this.prisma.aiResult.count({ where: { userId, updatedAt: { gte: dayStart } } }),
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
}
