import {
  type ApplicationMatchResponse,
  type ApplicationResponse,
  hasMatchVacancy,
  type ResumeProfileStatus,
  type ResumeVersion,
} from '@jobflow/shared';

import { isProfileReading } from '@/entities/resume';

export type MatchJob = NonNullable<ApplicationMatchResponse['job']>;

export type ScoredMatch = NonNullable<ApplicationMatchResponse['match']>;

export type MatchView =
  | { kind: 'no_cv' }
  | { kind: 'pending'; job: MatchJob | null }
  | { kind: 'failed' }
  | { kind: 'scored'; match: ScoredMatch }
  | { kind: 'unscored' }
  | { kind: 'no_vacancy' };

export type MatchViewInput = Readonly<{
  resumeVersionId: ApplicationResponse['resumeVersionId'];
  response: ApplicationMatchResponse;
  relinkedTo: ResumeVersion['id'] | null;
  versionProfileStatus: ResumeProfileStatus | undefined;
  isDraft: ApplicationResponse['isDraft'];
  vacancy: Pick<ApplicationResponse, 'rawText' | 'stack'>;
}>;

const NO_CV: MatchView = { kind: 'no_cv' };

const FAILED: MatchView = { kind: 'failed' };

const UNSCORED: MatchView = { kind: 'unscored' };

const PLACEHOLDER: MatchView = { kind: 'pending', job: null };

const NO_VACANCY: MatchView = { kind: 'no_vacancy' };

function isRunning(job: MatchJob | null): job is MatchJob & { status: 'queued' | 'processing' } {
  return job?.status === 'queued' || job?.status === 'processing';
}

function awaitsJob({ resumeVersionId, relinkedTo, versionProfileStatus }: MatchViewInput) {
  return (
    (relinkedTo === resumeVersionId && versionProfileStatus === 'done') ||
    isProfileReading(versionProfileStatus)
  );
}

function notScoredViewOf(input: MatchViewInput): MatchView {
  const { job } = input.response;
  if (!hasMatchVacancy(input.vacancy)) return NO_VACANCY;
  if (job?.status === 'failed') return FAILED;
  if (job === null && !input.isDraft && awaitsJob(input)) return PLACEHOLDER;
  return UNSCORED;
}

export function matchViewOf(input: MatchViewInput): MatchView {
  const { resumeVersionId, response } = input;
  if (resumeVersionId === null) return NO_CV;
  const { match, job } = response;
  if (isRunning(job)) return { kind: 'pending', job };
  if (match?.resumeVersion.id === resumeVersionId) return { kind: 'scored', match };
  return notScoredViewOf(input);
}
