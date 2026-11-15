import type { ApplicationMatchResponse, MatchBreakdown, MatchOutput } from '@jobflow/shared';

import { notFound } from '../common/app-error.js';
import { APPLICATION_NOT_FOUND } from '../common/owned.js';
import type {
  CvHintsQuery,
  CvHintsSourceRow,
  LatestCvHintsJob,
  RecordCvHintsRequested,
} from '../modules/cv-hints/index.js';
import { scoreMatch } from '../modules/match/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MATCH_OUTPUT, RESUME_PROFILE } from './ai.js';
import { applicationPath, type SignedInSearcher, signedInWithSearch } from './applications.js';
import {
  createAiJob,
  createAiResult,
  createApplicationRows,
  createResumeVersion,
} from './factories.js';
import { MATCH_SOURCE, MATCH_VERSION_LABEL, MATCHABLE_ROW } from './match.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from './service-fixtures.js';
import { NOW } from './time.js';

export const cvHintsPath = (id: string) => `${applicationPath(id)}/cv-hints`;

function breakdownOf(output: MatchOutput): MatchBreakdown {
  const breakdown = scoreMatch(output);
  if (breakdown === null) {
    throw new Error('the match fixture weighs no requirement');
  }
  return breakdown;
}

export const MATCH_BREAKDOWN = breakdownOf(MATCH_OUTPUT);

export const SCORED_MATCH: ApplicationMatchResponse = {
  match: { ...MATCH_BREAKDOWN, resumeVersion: MATCH_VERSION_LABEL, computedAt: NOW.toISOString() },
  job: null,
};

export const CV_HINTS_SOURCE_ROW: CvHintsSourceRow = {
  position: MATCH_SOURCE.position,
  resumeVersionId: RESUME_VERSION_ID,
  resumeVersion: { aiProfile: RESUME_PROFILE },
};

const reachesOlena = (userId: string, applicationId: string) =>
  userId === OLENA_ID && applicationId === APPLICATION_ID;

export class FakeMatchReader {
  response: ApplicationMatchResponse = SCORED_MATCH;

  read(userId: string, applicationId: string): Promise<ApplicationMatchResponse> {
    return reachesOlena(userId, applicationId)
      ? Promise.resolve(this.response)
      : Promise.reject(notFound(APPLICATION_NOT_FOUND));
  }
}

export class FakeCvHintsRepository {
  source: CvHintsSourceRow = CV_HINTS_SOURCE_ROW;

  latest: LatestCvHintsJob | null = null;

  runningJobId: string | null = null;

  readonly latestReads: CvHintsQuery[] = [];

  readonly recorded: [string, RecordCvHintsRequested][] = [];

  findProfile(userId: string, applicationId: string): Promise<CvHintsSourceRow | null> {
    return Promise.resolve(reachesOlena(userId, applicationId) ? this.source : null);
  }

  lockApplication(userId: string, { applicationId }: { applicationId: string }) {
    const reached = reachesOlena(userId, applicationId);
    return Promise.resolve(reached ? { runningJobId: this.runningJobId } : null);
  }

  recordRequested(userId: string, recorded: RecordCvHintsRequested): Promise<void> {
    this.recorded.push([userId, recorded]);
    return Promise.resolve();
  }

  findLatest(userId: string, query: CvHintsQuery): Promise<LatestCvHintsJob | null> {
    this.latestReads.push(query);
    return Promise.resolve(reachesOlena(userId, query.applicationId) ? this.latest : null);
  }
}

export type ScoredOwner = SignedInSearcher & { applicationId: string; resumeVersionId: string };

export async function scoredOwner(prisma: PrismaService): Promise<ScoredOwner> {
  const owner = await signedInWithSearch(prisma);
  const { userId } = owner;
  const resumeVersionId = await createResumeVersion(prisma, userId);
  await prisma.resumeVersion.update({
    where: { id: resumeVersionId },
    data: { aiProfile: RESUME_PROFILE },
  });
  const [applicationId = ''] = await createApplicationRows(prisma, {
    ...owner,
    rows: [{ ...MATCHABLE_ROW, resumeVersionId }],
  });
  const aiResultId = await createAiResult(prisma, { userId, kind: 'match', output: MATCH_OUTPUT });
  const linked = { userId, applicationId, resumeVersionId };
  await createAiJob(prisma, {
    ...linked,
    kind: 'match',
    status: 'done',
    aiResultId,
    finishedAt: NOW,
  });
  return { ...owner, applicationId, resumeVersionId };
}
