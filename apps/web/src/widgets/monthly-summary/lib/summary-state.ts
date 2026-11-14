import type { JobStatus, Summary, SummaryResponse } from '@jobflow/shared';

import { aiJobOf } from '@/entities/application';
import type { AiJob } from '@/shared/ui/async-state';

export type SummaryLatest = Readonly<{ data: SummaryResponse | undefined; isError: boolean }>;

export type SummaryState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'load-failed' }>
  | Readonly<{ status: 'empty' }>
  | Readonly<{ status: 'generating'; job: AiJob }>
  | Readonly<{ status: 'job-failed'; summary: Summary | null }>
  | Readonly<{ status: 'ready'; summary: Summary }>;

export type SummaryStateInput = Readonly<{ latest: SummaryLatest; job: JobStatus | undefined }>;

export function runningJobOf(data: SummaryResponse | undefined): SummaryResponse['job'] {
  const job = data?.job ?? null;
  return job?.status === 'queued' || job?.status === 'processing' ? job : null;
}

function answeredStateOf({ summary, job }: SummaryResponse): SummaryState {
  if (job?.status === 'failed' && job.id !== summary?.aiJobId) {
    return { status: 'job-failed', summary };
  }
  return summary === null ? { status: 'empty' } : { status: 'ready', summary };
}

export function summaryStateOf({ latest, job }: SummaryStateInput): SummaryState {
  const { data } = latest;
  if (data === undefined) return { status: latest.isError ? 'load-failed' : 'loading' };
  if (runningJobOf(data) !== null) return { status: 'generating', job: aiJobOf(job) };
  return answeredStateOf(data);
}
