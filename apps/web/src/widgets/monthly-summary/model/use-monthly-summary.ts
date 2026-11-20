'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { jobQueryOptions } from '@/entities/application';
import { latestSummaryQueryOptions } from '@/entities/summary';
import { useLivePollMs } from '@/shared/api';
import { sectionLoadOf } from '@/shared/lib/section-load';

import { runningJobOf, summaryStateOf } from '../lib/summary-state';

export function useMonthlySummary() {
  const pollMs = useLivePollMs();
  const latest = useQuery({
    ...latestSummaryQueryOptions(),
    refetchOnMount: ({ state }) => (runningJobOf(state.data) === null ? true : 'always'),
    refetchInterval: ({ state }) => (runningJobOf(state.data) === null ? false : pollMs),
  });
  const running = runningJobOf(latest.data);
  const job = useQuery({
    ...jobQueryOptions(running?.id ?? null),
    refetchInterval: pollMs,
    placeholderData: keepPreviousData,
  });
  const load = sectionLoadOf(latest);
  return {
    latest: latest.data,
    latestQuery: latest,
    state: summaryStateOf({ latest: { data: latest.data, failed: load.failed }, job: job.data }),
    load,
  };
}

export type MonthlySummary = ReturnType<typeof useMonthlySummary>;
