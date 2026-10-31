import { applicationFiltersSchema } from '@jobflow/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { applicationListQueryOptions } from '@/entities/application';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

export const SEARCH_LIMITS = { debounceMs: 250, minLength: 2, maxLength: 200, results: 8 } as const;

export function isSearchable(text: string): boolean {
  return (
    text.length >= SEARCH_LIMITS.minLength &&
    applicationFiltersSchema.shape.q.safeParse(text).success
  );
}

export function useApplicationSearch(text: string) {
  const q = useDebouncedValue(text.trim(), SEARCH_LIMITS.debounceMs);
  return useQuery({
    ...applicationListQueryOptions({ q, limit: SEARCH_LIMITS.results, sort: 'relevance' }),
    enabled: isSearchable(q),
    placeholderData: keepPreviousData,
  });
}

export type ApplicationSearch = ReturnType<typeof useApplicationSearch>;
