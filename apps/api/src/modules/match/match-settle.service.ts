import { matchOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { SettledAiJob } from '../ai/index.js';
import { MatchRepository } from './match.repository.js';
import { scoreMatch } from './match-score.js';

@Injectable()
export class MatchSettleService {
  constructor(private readonly repository: MatchRepository) {}

  async settle(settled: SettledAiJob): Promise<void> {
    const { userId, applicationId, resumeVersionId } = settled.job;
    if (
      settled.status === 'failed' ||
      applicationId === undefined ||
      resumeVersionId === undefined
    ) {
      return;
    }
    const breakdown = scoreMatch(matchOutputSchema.parse(settled.output));
    if (breakdown !== null) {
      const { score } = breakdown;
      await this.repository.saveScore(userId, { applicationId, resumeVersionId, score });
    }
  }
}
