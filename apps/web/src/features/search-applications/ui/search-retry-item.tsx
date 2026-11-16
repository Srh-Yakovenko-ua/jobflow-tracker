'use client';

import { Command } from 'cmdk';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { COMMAND_ITEM } from '@/shared/ui/field-surface';

import type { SearchStatusProps } from './search-status';

export type SearchRetryItemProps = SearchStatusProps & Readonly<{ forceMount?: boolean }>;

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
      {uk.shell.search.retry}
    </Command.Item>
  );
}
