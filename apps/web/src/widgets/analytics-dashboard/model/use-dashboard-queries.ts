'use client';

import { useQuery } from '@tanstack/react-query';

import {
  forecastQueryOptions,
  funnelQueryOptions,
  insightsQueryOptions,
  reasonsQueryOptions,
  sankeyQueryOptions,
  sourcesQueryOptions,
  timingsQueryOptions,
} from '@/entities/analytics';
import { resumeAbQueryOptions } from '@/entities/resume';

import type { SearchScope } from './use-search-scope';

export type DashboardScope = Pick<SearchScope, 'selectedId' | 'searchId'>;

export function useDashboardQueries({ selectedId, searchId }: DashboardScope) {
  return {
    funnel: useQuery(funnelQueryOptions(searchId)),
    sankey: useQuery(sankeyQueryOptions(searchId)),
    reasons: useQuery(reasonsQueryOptions(selectedId)),
    sources: useQuery(sourcesQueryOptions(selectedId)),
    timings: useQuery(timingsQueryOptions(selectedId)),
    forecast: useQuery(forecastQueryOptions(selectedId)),
    insights: useQuery(insightsQueryOptions(selectedId)),
    resumeAb: useQuery(resumeAbQueryOptions()),
  };
}

export type DashboardQueries = ReturnType<typeof useDashboardQueries>;
