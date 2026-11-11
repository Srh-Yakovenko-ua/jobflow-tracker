'use client';

import type { ApplicationResponse, JobStatus } from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { applicationQueryOptions, jobQueryOptions } from '@/entities/application';
import { ApiError, useLivePollMs } from '@/shared/api';

export type Capture = Readonly<{
  applicationId: ApplicationResponse['id'];
  jobId: JobStatus['id'] | null;
}>;

export type CaptureReads = Readonly<{
  job: UseQueryResult<JobStatus>;
  owned: JobStatus | undefined;
  application: UseQueryResult<ApplicationResponse>;
  settled: boolean;
}>;

type JobRead = Readonly<{ data: JobStatus | undefined; error: unknown }>;

export function isGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

function jobEnded({ data, error }: JobRead, applicationId: Capture['applicationId']): boolean {
  if (isGone(error)) return true;
  if (data === undefined) return false;
  return data.applicationId !== applicationId || data.status === 'done' || data.status === 'failed';
}

export function useCapture({ applicationId, jobId }: Capture): CaptureReads {
  const pollMs = useLivePollMs();
  const job = useQuery({
    ...jobQueryOptions(jobId),
    enabled: ({ state }) => !isGone(state.error),
    refetchInterval: ({ state }) => (jobEnded(state, applicationId) ? false : pollMs),
  });
  const settled = jobId === null || jobEnded(job, applicationId);
  const application = useQuery({
    ...applicationQueryOptions(applicationId),
    enabled: settled,
    staleTime: 0,
  });
  const owned = job.data?.applicationId === applicationId ? job.data : undefined;
  return { job, owned, application, settled };
}
