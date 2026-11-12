import type { AiCompleteJob } from '../modules/ai/index.js';
import type {
  LatestMatchRow,
  LinkedVersion,
  MatchScoreWrite,
  MatchSource,
} from '../modules/match/index.js';
import { AI_JOB_ID, MATCH_OUTPUT, RESUME_PROFILE, VACANCY_TEXT } from './ai.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from './service-fixtures.js';
import { NOW } from './time.js';

export const MATCH_SOURCE: MatchSource = {
  position: 'Senior React developer',
  stack: ['React'],
  rawText: VACANCY_TEXT,
  resumeVersionId: RESUME_VERSION_ID,
  resumeVersion: { aiProfile: RESUME_PROFILE },
};

export const MATCH_JOB: AiCompleteJob = {
  aiJobId: AI_JOB_ID,
  userId: OLENA_ID,
  kind: 'match',
  input: {},
  applicationId: APPLICATION_ID,
  resumeVersionId: RESUME_VERSION_ID,
};

export const MATCH_VERSION_LABEL = { id: RESUME_VERSION_ID, number: 2, title: 'CV v2' };

export const LATEST_MATCH: LatestMatchRow = {
  finishedAt: NOW,
  resumeVersion: MATCH_VERSION_LABEL,
  aiResult: { output: MATCH_OUTPUT },
};

const ownsApplication = (userId: string, applicationId: string) =>
  userId === OLENA_ID && applicationId === APPLICATION_ID;

export class FakeMatchRepository {
  source: MatchSource = MATCH_SOURCE;

  latest: LatestMatchRow | null = LATEST_MATCH;

  readonly scores: MatchScoreWrite[] = [];

  readonly cleared: string[] = [];

  readonly latestReads: LinkedVersion[] = [];

  findSource(userId: string, applicationId: string): Promise<MatchSource | null> {
    return Promise.resolve(ownsApplication(userId, applicationId) ? this.source : null);
  }

  saveScore(userId: string, write: MatchScoreWrite): Promise<number> {
    const linked =
      ownsApplication(userId, write.applicationId) &&
      write.resumeVersionId === this.source.resumeVersionId;
    return Promise.resolve(linked ? this.scores.push(write) : 0);
  }

  clearScore(userId: string, applicationId: string): Promise<number> {
    const unlinked = ownsApplication(userId, applicationId) && this.source.resumeVersionId === null;
    return Promise.resolve(unlinked ? this.cleared.push(applicationId) : 0);
  }

  findLatest(userId: string, linked: LinkedVersion): Promise<LatestMatchRow | null> {
    this.latestReads.push(linked);
    return Promise.resolve(ownsApplication(userId, linked.applicationId) ? this.latest : null);
  }
}
