import { AI_JOB_FAILURES, type JobStatus } from '@jobflow/shared';

import { jobWaiting } from './ai-job';

export type AiResultView<Result> =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'waiting' }>
  | Readonly<{ kind: 'failed'; timeout: boolean }>
  | Readonly<{ kind: 'ready'; result: Result }>;

export type AiRequestView = Exclude<AiResultView<unknown>, Readonly<{ kind: 'ready' }>>;

export type AiResultResponse<Result> = Readonly<{
  result: Result | null;
  job: Pick<JobStatus, 'status' | 'errorType'> | null;
}>;

export type AiResultViewInput<Result> = Readonly<{
  response: AiResultResponse<Result>;
  refused: boolean;
}>;

export function aiResultViewOf<Result>({
  response,
  refused,
}: AiResultViewInput<Result>): AiResultView<Result> {
  const { result, job } = response;
  if (refused) return { kind: 'failed', timeout: false };
  if (jobWaiting(job)) return { kind: 'waiting' };
  if (result !== null) return { kind: 'ready', result };
  if (job?.status === 'failed') {
    return { kind: 'failed', timeout: job.errorType === AI_JOB_FAILURES.timeout };
  }
  return { kind: 'idle' };
}
