import type {
  ApplicationMatchResponse,
  ApplicationResponse,
  ResumeProfileStatus,
  ResumeVersion,
} from '@jobflow/shared';

export type MatchJob = NonNullable<ApplicationMatchResponse['job']>;

export type ScoredMatch = NonNullable<ApplicationMatchResponse['match']>;

export type MatchView =
  | { kind: 'no_cv' }
  | { kind: 'pending'; job: MatchJob | null }
  | { kind: 'failed' }
  | { kind: 'scored'; match: ScoredMatch }
  | { kind: 'unscored' };

export type MatchViewInput = Readonly<{
  resumeVersionId: ApplicationResponse['resumeVersionId'];
  response: ApplicationMatchResponse;
  relinkedTo: ResumeVersion['id'] | null;
  versionProfileStatus: ResumeProfileStatus | undefined;
}>;

const NO_CV: MatchView = { kind: 'no_cv' };

const FAILED: MatchView = { kind: 'failed' };

const UNSCORED: MatchView = { kind: 'unscored' };

const PLACEHOLDER: MatchView = { kind: 'pending', job: null };

const PROFILE_READING: ReadonlySet<ResumeProfileStatus | undefined> = new Set([
  'queued',
  'processing',
]);

export function isProfileRead(status: ResumeProfileStatus | undefined): boolean {
  return PROFILE_READING.has(status);
}

function isRunning(job: MatchJob | null): job is MatchJob & { status: 'queued' | 'processing' } {
  return job?.status === 'queued' || job?.status === 'processing';
}

function awaitsJob({ resumeVersionId, relinkedTo, versionProfileStatus }: MatchViewInput) {
  return (
    (relinkedTo === resumeVersionId && versionProfileStatus === 'done') ||
    isProfileRead(versionProfileStatus)
  );
}

export function matchViewOf(input: MatchViewInput): MatchView {
  const { resumeVersionId, response } = input;
  if (resumeVersionId === null) return NO_CV;
  const { match, job } = response;
  if (isRunning(job)) return { kind: 'pending', job };
  if (match?.resumeVersion.id === resumeVersionId) return { kind: 'scored', match };
  if (job?.status === 'failed') return FAILED;
  if (job === null && awaitsJob(input)) return PLACEHOLDER;
  return UNSCORED;
}
