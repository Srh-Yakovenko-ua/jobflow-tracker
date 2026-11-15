import { AI_JOB_STEPS, type JobStatus } from '@jobflow/shared';

import type { AiJob } from '@/shared/ui/async-state';

export function jobWaiting(job: Pick<JobStatus, 'status'> | null): boolean {
  return job?.status === 'queued' || job?.status === 'processing';
}

export function aiJobOf(job: JobStatus | undefined): AiJob {
  if (job?.status === 'queued' && job.queue !== null) {
    return { status: 'queued', ...job.queue };
  }
  return {
    status: 'processing',
    step: job?.step ?? AI_JOB_STEPS.queued,
    steps: AI_JOB_STEPS.total,
  };
}
