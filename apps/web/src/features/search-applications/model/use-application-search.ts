import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { applicationListQueryOptions, isSearchable, SEARCH_LIMITS } from '@/entities/application';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';

export function useApplicationSearch(text: string) {
  const typed = text.trim();
  const q = useDebouncedValue(typed, SEARCH_LIMITS.debounceMs);
  return useQuery({
    ...applicationListQueryOptions({ q: typed, limit: SEARCH_LIMITS.results, sort: 'relevance' }),
    enabled: isSearchable(q) && q === typed,
    placeholderData: keepPreviousData,
  });
}

export type ApplicationSearch = ReturnType<typeof useApplicationSearch>;
