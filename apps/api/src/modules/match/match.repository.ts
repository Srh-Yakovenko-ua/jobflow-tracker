import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const MATCH_SOURCE_SELECT = {
  position: true,
  stack: true,
  rawText: true,
  resumeVersionId: true,
  resumeVersion: { select: { aiProfile: true } },
} satisfies Prisma.ApplicationSelect;

const LATEST_MATCH_SELECT = {
  finishedAt: true,
  resumeVersion: { select: { id: true, number: true, title: true } },
  aiResult: { select: { output: true } },
} satisfies Prisma.AiJobSelect;

export type MatchSource = Prisma.ApplicationGetPayload<{ select: typeof MATCH_SOURCE_SELECT }>;

export type LatestMatchRow = Prisma.AiJobGetPayload<{ select: typeof LATEST_MATCH_SELECT }>;

export type LinkedVersion = { applicationId: string; resumeVersionId: string };

export type MatchScoreWrite = LinkedVersion & { score: number };

@Injectable()
export class MatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSource(userId: string, applicationId: string): Promise<MatchSource | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: MATCH_SOURCE_SELECT,
    });
  }

  async saveScore(
    userId: string,
    { applicationId, resumeVersionId, score }: MatchScoreWrite,
  ): Promise<number> {
    const { count } = await this.prisma.application.updateMany({
      where: { id: applicationId, userId, deletedAt: null, resumeVersionId },
      data: { matchScore: score },
    });
    return count;
  }

  async clearScore(userId: string, applicationId: string): Promise<number> {
    const { count } = await this.prisma.application.updateMany({
      where: { id: applicationId, userId, resumeVersionId: null, matchScore: { not: null } },
      data: { matchScore: null },
    });
    return count;
  }

  findLatest(
    userId: string,
    { applicationId, resumeVersionId }: LinkedVersion,
  ): Promise<LatestMatchRow | null> {
    return this.prisma.aiJob.findFirst({
      where: {
        userId,
        applicationId,
        resumeVersionId,
        kind: 'match',
        status: 'done',
        aiResultId: { not: null },
      },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      select: LATEST_MATCH_SELECT,
    });
  }
}
