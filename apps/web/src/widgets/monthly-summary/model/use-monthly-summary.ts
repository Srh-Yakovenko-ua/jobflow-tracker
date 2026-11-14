'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { jobQueryOptions } from '@/entities/application';
import { latestSummaryQueryOptions } from '@/entities/summary';
import { useLivePollMs } from '@/shared/api';

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
  return {
    latest: latest.data,
    state: summaryStateOf({ latest, job: job.data }),
    retry: () => {
      void latest.refetch();
    },
  };
}

export type MonthlySummary = ReturnType<typeof useMonthlySummary>;
