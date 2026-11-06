import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { applicationListQueryOptions, isSearchable, SEARCH_LIMITS } from '@/entities/application';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

export function useApplicationSearch(text: string) {
  const q = useDebouncedValue(text.trim(), SEARCH_LIMITS.debounceMs);
  return useQuery({
    ...applicationListQueryOptions({ q, limit: SEARCH_LIMITS.results, sort: 'relevance' }),
    enabled: isSearchable(q),
    placeholderData: keepPreviousData,
  });
}

export type ApplicationSearch = ReturnType<typeof useApplicationSearch>;
