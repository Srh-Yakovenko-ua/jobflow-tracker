import type { SearchSummary } from '@jobflow/shared';

export function activeSearchOf(items: readonly SearchSummary[]): SearchSummary | undefined {
  return items.find((search) => search.status === 'active');
}
