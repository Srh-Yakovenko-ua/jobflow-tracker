import { type ApplicationMatchResponse, matchOutputSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { owned } from '../../common/owned.js';
import { type LatestMatchRow, MatchRepository } from './match.repository.js';
import { scoreMatch } from './match-score.js';

type ApplicationMatch = ApplicationMatchResponse['match'];

function matchOf({ finishedAt, resumeVersion, aiResult }: LatestMatchRow): ApplicationMatch {
  if (finishedAt === null || resumeVersion === null || aiResult === null) {
    return null;
  }
  const breakdown = scoreMatch(matchOutputSchema.parse(aiResult.output));
  return breakdown === null
    ? null
    : { ...breakdown, resumeVersion, computedAt: finishedAt.toISOString() };
}

@Injectable()
export class MatchService {
  constructor(private readonly repository: MatchRepository) {}

  async read(userId: string, applicationId: string): Promise<ApplicationMatchResponse> {
    const { resumeVersionId } = owned(await this.repository.findSource(userId, applicationId));
    if (resumeVersionId === null) {
      return { match: null };
    }
    const latest = await this.repository.findLatest(userId, { applicationId, resumeVersionId });
    return { match: latest === null ? null : matchOf(latest) };
  }
}
