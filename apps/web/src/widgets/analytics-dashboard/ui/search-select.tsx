'use client';

import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { Field } from '@/shared/ui/field';
import { Select, type SelectView } from '@/shared/ui/select';

import { searchGroupsOf } from '../lib/search-groups';
import type { SearchScope } from '../model/use-search-scope';

function viewOf(scope: SearchScope): SelectView {
  if (scope.searches.isError) return { status: 'disabled' };
  if (scope.searches.data === undefined) return { status: 'loading' };
  return {};
}

export type SearchSelectProps = Readonly<{ scope: SearchScope }>;

export function SearchSelect({ scope }: SearchSelectProps) {
  const timeZone = useUserTimeZone();
  const searches = scope.searches.data?.items ?? [];
  return (
    <div className="w-full sm:w-72">
      <Field label={<span className="sr-only">{uk.analytics.search.label}</span>}>
        <Select
          groups={searchGroupsOf({ searches, timeZone })}
          value={scope.searchId ?? ''}
          onValueChange={scope.select}
          view={viewOf(scope)}
        />
      </Field>
    </div>
  );
}
