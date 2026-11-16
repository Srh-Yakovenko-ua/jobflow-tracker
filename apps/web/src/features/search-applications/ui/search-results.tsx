'use client';

import { Command } from 'cmdk';

import { uk } from '@/shared/i18n';

import { ApplicationResults, type ApplicationResultsProps } from './application-results';
import { SearchRetryItem } from './search-retry-item';
import { SearchStatus } from './search-status';

export type SearchResultsProps = ApplicationResultsProps;

export function SearchResults({ search, onPick }: SearchResultsProps) {
  return (
    <>
      <SearchStatus search={search} />
      <Command.List label={uk.shell.search.results} className="max-h-80 overflow-y-auto">
        <ApplicationResults search={search} onPick={onPick} />
        <SearchRetryItem search={search} />
      </Command.List>
    </>
  );
}
