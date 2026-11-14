'use client';

import type { SankeySplit } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import {
  forecastQueryOptions,
  type ForecastWhatIf,
  funnelQueryOptions,
  insightsQueryOptions,
  reasonsQueryOptions,
  sankeyQueryOptions,
  sourcesQueryOptions,
  timingsQueryOptions,
} from '@/entities/analytics';
import { resumeAbQueryOptions } from '@/entities/resume';
import { latestSummaryQueryOptions } from '@/entities/summary';

import type { SearchScope } from './use-search-scope';

export type DashboardScope = Pick<SearchScope, 'selectedId' | 'searchId'> &
  Readonly<{ split: SankeySplit | undefined; whatIf: ForecastWhatIf }>;

export function useDashboardQueries({ selectedId, searchId, split, whatIf }: DashboardScope) {
  return {
    funnel: useQuery(funnelQueryOptions(searchId)),
    sankey: useQuery(sankeyQueryOptions({ searchId, split })),
    reasons: useQuery(reasonsQueryOptions(selectedId)),
    sources: useQuery(sourcesQueryOptions(selectedId)),
    timings: useQuery(timingsQueryOptions(selectedId)),
    forecast: useQuery(forecastQueryOptions({ searchId: selectedId, ...whatIf })),
    insights: useQuery(insightsQueryOptions(selectedId)),
    resumeAb: useQuery(resumeAbQueryOptions()),
    summary: useQuery(latestSummaryQueryOptions()),
  };
}

export type DashboardQueries = ReturnType<typeof useDashboardQueries>;
