'use client';

import { Command } from 'cmdk';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { COMMAND_ITEM } from '@/shared/ui/field-surface';
import { NoMatches } from '@/shared/ui/no-matches';
import { Spinner } from '@/shared/ui/spinner';

import type { ApplicationSearch } from '../model/use-application-search';

const SEARCH = uk.shell.search;

export type SearchStatusProps = Readonly<{ search: ApplicationSearch }>;

export type SearchRetryItemProps = SearchStatusProps & Readonly<{ forceMount?: boolean }>;

const STATUS_ROW = 'caption flex items-center gap-2 px-2.5 py-3';

export function SearchStatus({ search }: SearchStatusProps) {
  if (search.isPending) {
    return (
      <div role="status" className={cn(STATUS_ROW, 'text-ink-3')}>
        <Spinner />
        {SEARCH.loading}
      </div>
    );
  }
  if (search.isError) {
    return (
      <p role="alert" className={cn(STATUS_ROW, 'text-danger')}>
        {SEARCH.error}
      </p>
    );
  }
  return search.data.items.length === 0 ? <NoMatches /> : null;
}

export function SearchRetryItem({ search, forceMount = false }: SearchRetryItemProps) {
  if (!search.isError) return null;
  return (
    <Command.Item
      value="retry"
      forceMount={forceMount}
      onSelect={() => {
        void search.refetch();
      }}
      className={cn(COMMAND_ITEM, 'font-semibold text-link')}
    >
      {SEARCH.retry}
    </Command.Item>
  );
}
