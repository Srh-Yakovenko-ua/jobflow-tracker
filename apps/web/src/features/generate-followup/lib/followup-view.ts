import { AI_JOB_FAILURES, type FollowupOutput, type FollowupResponse } from '@jobflow/shared';

export type FollowupFailed = Readonly<{ timeout: boolean }>;

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
  | Readonly<{ kind: 'failed'; timeout: boolean }>
  | FollowupReady;

export type FollowupViewInput = Readonly<{
  response: FollowupResponse;
  manual: boolean;
  refused: boolean;
}>;

const REFUSED: FollowupFailed = { timeout: false };

export function followupWaiting({ job }: Pick<FollowupResponse, 'job'>): boolean {
  return job?.status === 'queued' || job?.status === 'processing';
}

function ownDraftOf({ response, refused }: FollowupViewInput): FollowupReady {
  const { draft } = response;
  return {
    kind: 'ready',
    draft: draft ?? { subject: '', body: '' },
    key: draft?.generatedAt ?? 'own',
    own: true,
    failure: refused ? REFUSED : null,
  };
}

function failureOf({ job }: FollowupResponse): FollowupFailed | null {
  if (job?.status !== 'failed') return null;
  return { timeout: job.errorType === AI_JOB_FAILURES.timeout };
}

export function followupViewOf(input: FollowupViewInput): FollowupView {
  if (input.manual) return ownDraftOf(input);
  const { response, refused } = input;
  if (!refused && followupWaiting(response)) return { kind: 'waiting' };
  const failure = refused ? REFUSED : failureOf(response);
  const { draft } = response;
  if (draft === null) return failure === null ? { kind: 'idle' } : { kind: 'failed', ...failure };
  return { kind: 'ready', draft, key: draft.generatedAt, own: false, failure };
}
