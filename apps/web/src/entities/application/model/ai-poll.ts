'use client';

import type { JobStatus } from '@jobflow/shared';
import { type QueryKey, useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useLivePollMs } from '@/shared/api';
import { type SectionLoad, sectionLoadOf } from '@/shared/lib/section-load';
import type { AiJob } from '@/shared/ui/async-state';

import { jobQueryOptions } from '../api/job';
import { aiJobOf, jobWaiting } from '../lib/ai-job';

type AiResponse = Readonly<{ job: Pick<JobStatus, 'id' | 'status'> | null }>;

type PolledState<Data> = Readonly<{ state: Readonly<{ data: Data | undefined }> }>;

export type AiSectionInput<Data extends AiResponse, Key extends QueryKey> = Readonly<{
  query: UseQueryOptions<Data, Error, Data, Key>;
  shown: boolean;
}>;

export type AiSectionReady<Data> = Readonly<{ response: Data; job: AiJob }>;

export type AiSection<Data> = Readonly<{
  shown: boolean;
  load: SectionLoad;
  response: Data | undefined;
  job: AiJob;
}>;

function waitingIn(data: AiResponse | undefined): boolean {
  return data !== undefined && jobWaiting(data.job);
}

function pollWhileWaiting(pollMs: number) {
  return {
    refetchOnMount: ({ state }: PolledState<AiResponse>): boolean | 'always' =>
      waitingIn(state.data) ? 'always' : true,
    refetchInterval: ({ state }: PolledState<AiResponse>): number | false =>
      waitingIn(state.data) ? pollMs : false,
  };
}

function useWaitingJob(job: Readonly<{ id: JobStatus['id'] }> | null, pollMs: number): AiJob {
  const query = useQuery({ ...jobQueryOptions(job?.id ?? null), refetchInterval: pollMs });
  return aiJobOf(query.data);
}

export function useAiSection<Data extends AiResponse, Key extends QueryKey>({
  query,
  shown,
}: AiSectionInput<Data, Key>): AiSection<Data> {
  const pollMs = useLivePollMs();
  const section = useQuery({ ...query, enabled: shown, ...pollWhileWaiting(pollMs) });
  const waitingJob = waitingIn(section.data) ? (section.data?.job ?? null) : null;
  return {
    shown,
    load: sectionLoadOf(section),
    response: section.data,
    job: useWaitingJob(waitingJob, pollMs),
  };
}
