'use client';

import { useQuery } from '@tanstack/react-query';

import { forecastQueryOptions } from '@/entities/analytics';
import { activeSearchOf, searchesQueryOptions } from '@/entities/search';

import { weeksSoonerOf } from './rhythm-summary';

export function useRhythmEffect(suggestedGoal: number): number | null {
  const searches = useQuery(searchesQueryOptions());
  const enabled = searches.data !== undefined;
  const searchId = searches.data && activeSearchOf(searches.data.items)?.id;
  const baseline = useQuery({ ...forecastQueryOptions({ searchId }), enabled });
  const whatIf = useQuery({
    ...forecastQueryOptions({ searchId, applicationsPerWeek: suggestedGoal }),
    enabled,
  });
  return weeksSoonerOf({ baseline: baseline.data, whatIf: whatIf.data });
}
