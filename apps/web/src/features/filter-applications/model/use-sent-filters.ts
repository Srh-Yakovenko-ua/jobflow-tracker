'use client';

import type { ApplicationFilters } from '@jobflow/shared';

import { isSearchable, SEARCH_LIMITS } from '@/entities/application';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

import { useApplicationFilters } from './filters-store';

function searchableOf(text: string | undefined): string | undefined {
  const q = text?.trim();
  return q !== undefined && isSearchable(q) ? q : undefined;
}

export function useSentFilters(): ApplicationFilters {
  const filters = useApplicationFilters((store) => store.filters);
  const q = useDebouncedValue(filters.q, SEARCH_LIMITS.debounceMs);
  const salaryFrom = useDebouncedValue(filters.salaryFrom, SEARCH_LIMITS.debounceMs);
  return { ...filters, q: searchableOf(q), salaryFrom };
}
