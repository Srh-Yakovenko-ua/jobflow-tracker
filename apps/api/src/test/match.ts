import type { AiCompleteJob } from '../modules/ai/index.js';
import type { TimelineEntry } from '../modules/events/index.js';
import type {
  LatestMatchJob,
  LatestMatchRow,
  LinkedVersion,
  MatchScoreWrite,
  MatchSource,
} from '../modules/match/index.js';
import { AI_JOB_ID, MATCH_OUTPUT, RESUME_PROFILE, VACANCY_TEXT } from './ai.js';
import type { ApplicationRowInput } from './factories.js';
import { APPLICATION_ID, OLENA_ID, RESUME_VERSION_ID } from './service-fixtures.js';
import { NOW } from './time.js';

export const MATCH_SOURCE: MatchSource = {
  position: 'Senior React developer',
  stack: ['React'],
  rawText: VACANCY_TEXT,
  isDraft: false,
  resumeVersionId: RESUME_VERSION_ID,
  resumeVersion: { aiProfile: RESUME_PROFILE },
};

export const MATCHABLE_ROW = {
  lastEventAt: NOW,
  position: MATCH_SOURCE.position,
  stack: MATCH_SOURCE.stack,
  rawText: MATCH_SOURCE.rawText,
} satisfies ApplicationRowInput;

export const MATCH_JOB: AiCompleteJob = {
  aiJobId: AI_JOB_ID,
  userId: OLENA_ID,
  kind: 'match',
  input: {},
  applicationId: APPLICATION_ID,
  resumeVersionId: RESUME_VERSION_ID,
};

export const SECOND_APPLICATION_ID = '0199f0a0-0000-7000-8000-0000000000c3';

export const scorePushOf = (userId: string) => (applicationId: string) => ({
  userId,
  event: { type: 'application.updated', data: { applicationId, fields: ['matchScore'] } },
});

export const matchScoredEntry = (applicationId: string) =>
  ({
    applicationId,
    kind: 'match_scored',
    payload: { score: 59 },
    occurredAt: NOW,
  }) satisfies TimelineEntry;

export const MATCH_VERSION_LABEL = { id: RESUME_VERSION_ID, number: 2, title: 'CV v2' };

export const LATEST_MATCH: LatestMatchRow = {
  finishedAt: NOW,
  resumeVersion: MATCH_VERSION_LABEL,
  aiResult: { output: MATCH_OUTPUT },
};

const ownsApplication = (userId: string, applicationId: string) =>
  userId === OLENA_ID && applicationId === APPLICATION_ID;

const ownsVersion = (userId: string, resumeVersionId: string) =>
  userId === OLENA_ID && resumeVersionId === RESUME_VERSION_ID;

export class FakeMatchRepository {
  source: MatchSource = MATCH_SOURCE;

  latest: LatestMatchRow | null = LATEST_MATCH;

  readonly scores: MatchScoreWrite[] = [];

  readonly cleared: string[] = [];

  readonly latestReads: LinkedVersion[] = [];

  latestJob: LatestMatchJob | null = null;

  readonly jobReads: LinkedVersion[] = [];

  activeVersionId: string | null = RESUME_VERSION_ID;

  linkedIds: string[] = [APPLICATION_ID];

  scorableIds: string[] = [APPLICATION_ID, SECOND_APPLICATION_ID];

  readonly links: string[] = [];

  newerJobId: string | null = null;

  findSource(userId: string, applicationId: string): Promise<MatchSource | null> {
    return Promise.resolve(ownsApplication(userId, applicationId) ? this.source : null);
  }

  saveScore(userId: string, write: MatchScoreWrite): Promise<number> {
    const linked =
      ownsApplication(userId, write.applicationId) &&
      write.resumeVersionId === this.source.resumeVersionId;
    const newest = this.newerJobId === null || this.newerJobId <= write.aiJobId;
    return Promise.resolve(linked && newest ? this.scores.push(write) : 0);
  }

  clearScore(userId: string, applicationId: string): Promise<number> {
    const unlinked = ownsApplication(userId, applicationId) && this.source.resumeVersionId === null;
    return Promise.resolve(unlinked ? this.cleared.push(applicationId) : 0);
  }

  findLatest(userId: string, linked: LinkedVersion): Promise<LatestMatchRow | null> {
    this.latestReads.push(linked);
    return Promise.resolve(ownsApplication(userId, linked.applicationId) ? this.latest : null);
  }

  findLatestJob(userId: string, linked: LinkedVersion): Promise<LatestMatchJob | null> {
    this.jobReads.push(linked);
    return Promise.resolve(ownsApplication(userId, linked.applicationId) ? this.latestJob : null);
  }

  linkUnlinked(userId: string, resumeVersionId: string): Promise<number> {
    const active = ownsVersion(userId, resumeVersionId) && resumeVersionId === this.activeVersionId;
    return Promise.resolve(active ? this.links.push(resumeVersionId) : 0);
  }

  findLinkedIds(userId: string, resumeVersionId: string): Promise<string[]> {
    return Promise.resolve(ownsVersion(userId, resumeVersionId) ? this.linkedIds : []);
  }

  findActiveVersionId(userId: string): Promise<string | null> {
    return Promise.resolve(userId === OLENA_ID ? this.activeVersionId : null);
  }

  findScorableIds(userId: string): Promise<string[]> {
    return Promise.resolve(userId === OLENA_ID ? this.scorableIds : []);
  }
}

export type ScheduledMatch = { userId: string; applicationIds: readonly string[] };

export type RematchedVersion = { userId: string; resumeVersionId: string };

export class RecordingMatchTriggers {
  readonly scheduled: ScheduledMatch[] = [];

  readonly rematched: RematchedVersion[] = [];

  schedule(userId: string, applicationIds: readonly string[]): Promise<number> {
    this.scheduled.push({ userId, applicationIds });
    return Promise.resolve(applicationIds.length);
  }

  rematchVersion(userId: string, resumeVersionId: string): Promise<number> {
    this.rematched.push({ userId, resumeVersionId });
    return Promise.resolve(1);
  }
}
