'use client';

import type { ApplicationCard } from '@jobflow/shared';
import { Command } from 'cmdk';

import { uk } from '@/shared/i18n';

import type { ApplicationSearch } from '../model/use-application-search';
import { ApplicationResultItem } from './application-result-item';
import { SearchRetryItem, SearchStatus } from './search-status';

export type SearchResultsProps = Readonly<{
  search: ApplicationSearch;
  onPick: (application: ApplicationCard) => void;
}>;

export function SearchResults({ search, onPick }: SearchResultsProps) {
  return (
    <>
      <SearchStatus search={search} />
      <Command.List label={uk.shell.search.results} className="max-h-80 overflow-y-auto">
        {search.data?.items.map((application) => (
          <ApplicationResultItem key={application.id} application={application} onPick={onPick} />
        ))}
        <SearchRetryItem search={search} />
      </Command.List>
    </>
  );
}
