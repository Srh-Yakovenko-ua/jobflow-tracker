import type { SearchSummary } from '@jobflow/shared';

import { activeSearchOf } from '@/entities/search';
import type { SearchComparison } from '@/shared/i18n';

export function searchComparisonOf(items: readonly SearchSummary[]): SearchComparison | null {
  const current = activeSearchOf(items);
  const previous = items.find((search) => search.status === 'archived');
  return current === undefined || previous === undefined ? null : { current, previous };
}
