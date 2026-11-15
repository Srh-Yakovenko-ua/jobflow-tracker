import { AI_JOB_FAILURES, type CvHintsResponse } from '@jobflow/shared';

import { jobWaiting } from '@/entities/application';

export type CvHintsResult = NonNullable<CvHintsResponse['result']>;

export type CvHintsView =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'waiting' }>
  | Readonly<{ kind: 'failed'; timeout: boolean }>
  | Readonly<{ kind: 'ready'; result: CvHintsResult }>;

export type CvHintsViewInput = Readonly<{ response: CvHintsResponse; refused: boolean }>;

export function cvHintsViewOf({ response, refused }: CvHintsViewInput): CvHintsView {
  const { result, job } = response;
  if (refused) return { kind: 'failed', timeout: false };
  if (jobWaiting(job)) return { kind: 'waiting' };
  if (result !== null) return { kind: 'ready', result };
  if (job?.status === 'failed') {
    return { kind: 'failed', timeout: job.errorType === AI_JOB_FAILURES.timeout };
  }
  return { kind: 'idle' };
}
