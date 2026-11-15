import { AI_JOB_FAILURES } from '@jobflow/shared';

import { ServiceCallError } from '../common/service-call-error.js';

const RUN_STOPPERS = new Set<string>([
  AI_JOB_FAILURES.notReady,
  AI_JOB_FAILURES.timeout,
  'documents_timeout',
]);

export type Stopped = { stoppedBy: string };

type Refusal = { error: string } | Stopped;

export const isStopped = (outcome: object): outcome is Stopped => 'stoppedBy' in outcome;

export function refusalOf(error: unknown): Refusal {
  if (!(error instanceof ServiceCallError)) {
    throw error;
  }
  return RUN_STOPPERS.has(error.type) ? { stoppedBy: error.type } : { error: error.type };
}
