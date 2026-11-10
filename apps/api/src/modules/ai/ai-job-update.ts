import { AI_JOB_STEPS, type JobUpdated } from '@jobflow/shared';

import type { AiCompleteJob } from './ai.jobs.js';

export type AiJobProgress =
  | { job: AiCompleteJob; status: 'processing' | 'done' }
  | { job: AiCompleteJob; status: 'failed'; errorType: string };

const STEP_REACHED = {
  processing: AI_JOB_STEPS.processing,
  done: AI_JOB_STEPS.done,
  failed: AI_JOB_STEPS.processing,
} as const;

export function jobUpdateOf(progress: AiJobProgress): JobUpdated {
  const { job, status } = progress;
  return {
    id: job.aiJobId,
    kind: job.kind,
    status,
    step: STEP_REACHED[status],
    errorType: progress.status === 'failed' ? progress.errorType : null,
    applicationId: job.applicationId ?? null,
  };
}
