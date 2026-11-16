import {
  AI_JOB_FAILURES,
  type FollowupOutput,
  type FollowupResponse,
  type JobStatus,
} from '@jobflow/shared';

import { jobWaiting } from '@/entities/application';

export type FollowupFailureReason = 'timeout' | 'budget' | 'rateLimited' | 'other';

export type FollowupFailed = Readonly<{ reason: FollowupFailureReason }>;

export type FollowupReady = Readonly<{
  kind: 'ready';
  draft: FollowupOutput;
  key: string;
  own: boolean;
  failure: FollowupFailed | null;
}>;

export type FollowupView =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'waiting' }>
  | Readonly<{ kind: 'failed'; reason: FollowupFailureReason }>
  | FollowupReady;

export type FollowupViewInput = Readonly<{
  response: FollowupResponse;
  manual: boolean;
  refused: boolean;
  limited?: boolean;
}>;

const REFUSED: FollowupFailed = { reason: 'other' };

const BUDGET: FollowupFailed = { reason: 'budget' };

const RATE_LIMITED: FollowupFailed = { reason: 'rateLimited' };

const REASONS: Partial<Record<NonNullable<JobStatus['errorType']>, FollowupFailureReason>> = {
  [AI_JOB_FAILURES.timeout]: 'timeout',
  [AI_JOB_FAILURES.budgetExceeded]: 'budget',
};

function followupWaiting({ job }: Pick<FollowupResponse, 'job'>): boolean {
  return jobWaiting(job);
}

function ownDraftOf(response: FollowupResponse, failure: FollowupFailed | null): FollowupReady {
  const { draft } = response;
  return {
    kind: 'ready',
    draft: draft ?? { subject: '', body: '' },
    key: draft?.generatedAt ?? 'own',
    own: true,
    failure,
  };
}

function failureOf({ job }: FollowupResponse): FollowupFailed | null {
  if (job?.status !== 'failed') return null;
  const reason = job.errorType === null ? undefined : REASONS[job.errorType];
  return { reason: reason ?? 'other' };
}

function stillLimited({ response, limited }: FollowupViewInput): boolean {
  return limited === true && response.draft === null && !followupWaiting(response);
}

function ownPathOf(input: FollowupViewInput, failure: FollowupFailed | null): FollowupView | null {
  const { response, refused } = input;
  if (failure?.reason === 'budget') return ownDraftOf(response, BUDGET);
  if (input.manual) return ownDraftOf(response, refused ? REFUSED : null);
  return null;
}

export function followupViewOf(input: FollowupViewInput): FollowupView {
  const { response, refused } = input;
  const unsent = stillLimited(input) ? RATE_LIMITED : failureOf(response);
  const failure = refused ? REFUSED : unsent;
  const ownPath = ownPathOf(input, failure);
  if (ownPath !== null) return ownPath;
  if (!refused && followupWaiting(response)) return { kind: 'waiting' };
  const { draft } = response;
  if (draft === null) return failure === null ? { kind: 'idle' } : { kind: 'failed', ...failure };
  return { kind: 'ready', draft, key: draft.generatedAt, own: false, failure };
}
