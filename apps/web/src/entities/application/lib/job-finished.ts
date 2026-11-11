import type { JobStatus } from '@jobflow/shared';

export function jobFinished(job: JobStatus | undefined): boolean {
  return job?.status === 'done' || job?.status === 'failed';
}
