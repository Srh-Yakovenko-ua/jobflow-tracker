import { applicationFiltersSchema } from '@jobflow/shared';

export const SEARCH_LIMITS = { debounceMs: 250, minLength: 2, maxLength: 200, results: 8 } as const;

export function isSearchable(text: string): boolean {
  return (
    text.length >= SEARCH_LIMITS.minLength &&
    applicationFiltersSchema.shape.q.safeParse(text).success
  );
}
