import type { SearchStatus, SearchSummary } from '@jobflow/shared';

import { searchDatesOf } from '@/entities/search';
import { uk } from '@/shared/i18n';
import type { SelectOptionGroup } from '@/shared/ui/field-surface';

const COPY = uk.analytics.search;

export type SearchGroupsInput = Readonly<{ searches: readonly SearchSummary[]; timeZone: string }>;

type MetaOf = (search: SearchSummary, timeZone: string) => string;

const GROUPS: Readonly<Record<SearchStatus, { label: string; meta: MetaOf }>> = {
  active: { label: COPY.current, meta: (search) => COPY.applications(search.applications) },
  archived: { label: COPY.archived, meta: searchDatesOf },
};

const ORDER: readonly SearchStatus[] = ['active', 'archived'];

export function searchGroupsOf({ searches, timeZone }: SearchGroupsInput): SelectOptionGroup[] {
  return ORDER.map((status) => ({
    label: GROUPS[status].label,
    options: searches
      .filter((search) => search.status === status)
      .map((search) => ({
        value: search.id,
        label: search.title,
        meta: GROUPS[status].meta(search, timeZone),
      })),
  })).filter((group) => group.options.length > 0);
}
