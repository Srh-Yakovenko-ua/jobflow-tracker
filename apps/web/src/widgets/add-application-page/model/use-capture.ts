'use client';

import type { ApplicationResponse, JobStatus } from '@jobflow/shared';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { applicationQueryOptions, jobFinished, jobQueryOptions } from '@/entities/application';
import { isDeleteSent } from '@/features/delete-application';
import { isNotFound, useLivePollMs } from '@/shared/api';

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

function jobEnded({ data, error }: JobRead, applicationId: Capture['applicationId']): boolean {
  if (isNotFound(error)) return true;
  if (data === undefined) return false;
  return data.applicationId !== applicationId || jobFinished(data);
}

export function useCapture({ applicationId, jobId }: Capture): CaptureReads {
  const queryClient = useQueryClient();
  const pollMs = useLivePollMs();
  const job = useQuery({
    ...jobQueryOptions(jobId),
    enabled: ({ state }) => !isNotFound(state.error),
    refetchInterval: ({ state }) => (jobEnded(state, applicationId) ? false : pollMs),
  });
  const settled = jobId === null || jobEnded(job, applicationId);
  const application = useQuery({
    ...applicationQueryOptions(applicationId),
    enabled: ({ state }) =>
      settled && !isNotFound(state.error) && !isDeleteSent(queryClient, applicationId),
    staleTime: 0,
  });
  const owned = job.data?.applicationId === applicationId ? job.data : undefined;
  return { job, owned, application, settled };
}
