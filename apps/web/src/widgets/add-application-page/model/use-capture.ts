'use client';

import type { ApplicationResponse, JobStatus } from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { applicationQueryOptions, jobQueryOptions } from '@/entities/application';
import { useLivePollMs } from '@/shared/api';

export type Capture = Readonly<{
  applicationId: ApplicationResponse['id'];
  jobId: JobStatus['id'] | null;
}>;

export type CaptureReads = Readonly<{
  job: UseQueryResult<JobStatus>;
  application: UseQueryResult<ApplicationResponse>;
  settled: boolean;
}>;

function isSettled(job: JobStatus | undefined): boolean {
  return job?.status === 'done' || job?.status === 'failed';
}

export function useCapture({ applicationId, jobId }: Capture): CaptureReads {
  const pollMs = useLivePollMs();
  const job = useQuery({
    ...jobQueryOptions(jobId),
    refetchInterval: ({ state }) => (isSettled(state.data) ? false : pollMs),
  });
  const settled = jobId === null || isSettled(job.data);
  const application = useQuery({
    ...applicationQueryOptions(applicationId),
    enabled: settled,
    staleTime: 0,
  });
  return { job, application, settled };
}
