import { AI_JOB_FAILURES, type FollowupOutput, type FollowupResponse } from '@jobflow/shared';

export type FollowupReady = Readonly<{
  kind: 'ready';
  draft: FollowupOutput;
  key: string;
  own: boolean;
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

const OWN_DRAFT: FollowupReady = {
  kind: 'ready',
  draft: { subject: '', body: '' },
  key: 'own',
  own: true,
};

export function followupWaiting({ job }: Pick<FollowupResponse, 'job'>): boolean {
  return job?.status === 'queued' || job?.status === 'processing';
}

export function followupViewOf({ response, manual, refused }: FollowupViewInput): FollowupView {
  if (manual) return OWN_DRAFT;
  if (refused) return { kind: 'failed', timeout: false };
  const { job, draft } = response;
  if (followupWaiting(response)) return { kind: 'waiting' };
  if (job?.status === 'failed') {
    return { kind: 'failed', timeout: job.errorType === AI_JOB_FAILURES.timeout };
  }
  if (draft === null) return { kind: 'idle' };
  return { kind: 'ready', draft, key: draft.generatedAt, own: false };
}
