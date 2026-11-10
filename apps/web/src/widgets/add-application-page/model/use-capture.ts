'use client';

import { type ApplicationResponse, type JobStatus, LIVE_LIMITS } from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { applicationQueryOptions, jobQueryOptions } from '@/entities/application';
import { LIVE_CLIENT_LIMITS, useLiveConnected } from '@/shared/api';

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
  const connected = useLiveConnected();
  const job = useQuery({
    ...jobQueryOptions(jobId ?? ''),
    enabled: jobId !== null,
    refetchInterval: ({ state }) => {
      if (isSettled(state.data)) return false;
      return connected ? LIVE_CLIENT_LIMITS.slowPollMs : LIVE_LIMITS.pollFallbackMs;
    },
  });
  const settled = jobId === null || isSettled(job.data);
  const application = useQuery({
    ...applicationQueryOptions(applicationId),
    enabled: settled,
    staleTime: 0,
  });
  return { job, application, settled };
}
