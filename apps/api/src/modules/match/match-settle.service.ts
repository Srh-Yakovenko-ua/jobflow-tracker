import { matchOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { SettledAiJob } from '../ai/index.js';
import { TimelineService } from '../events/index.js';
import { MatchRepository } from './match.repository.js';
import { scoreMatch } from './match-score.js';

export type ScoredApplication = { userId: string; applicationId: string; score: number };

@Injectable()
export class MatchSettleService {
  constructor(
    private readonly repository: MatchRepository,
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly clock: Clock,
  ) {}

  async settle(settled: SettledAiJob): Promise<ScoredApplication | null> {
    const { aiJobId, userId, applicationId, resumeVersionId } = settled.job;
    if (
      settled.status === 'failed' ||
      applicationId === undefined ||
      resumeVersionId === undefined
    ) {
      return null;
    }
    const breakdown = scoreMatch(matchOutputSchema.parse(settled.output));
    if (breakdown === null) {
      return null;
    }
    const { score } = breakdown;
    const occurredAt = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const write = { applicationId, resumeVersionId, score, aiJobId, tx };
      if ((await this.repository.saveScore(userId, write)) === 0) {
        return null;
      }
      await this.timeline.recordFirst(userId, {
        applicationId,
        kind: 'match_scored',
        payload: { score },
        occurredAt,
        tx,
      });
      return { userId, applicationId, score };
    });
  }
}
