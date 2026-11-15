'use client';

import { useQuery } from '@tanstack/react-query';

import { resumeVersionsQueryOptions } from '@/entities/resume';

import { chipsOf, type FilterChip } from './application-filters';
import { useApplicationFilters } from './filters-store';

export function useFilterChips(): FilterChip[] {
  const filters = useApplicationFilters((store) => store.filters);
  const versions = useQuery(resumeVersionsQueryOptions()).data?.items;
  return chipsOf(filters, versions);
}
