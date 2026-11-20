'use client';

import { Command } from 'cmdk';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { COMMAND_ITEM } from '@/shared/ui/field-surface';

import type { SearchStatusProps } from './search-status';

export type SearchRetryItemProps = SearchStatusProps & Readonly<{ forceMount?: boolean }>;

export function SearchRetryItem({ search, forceMount = false }: SearchRetryItemProps) {
  const load = sectionLoadOf(search);
  if (!(load.failed || load.stale) || load.retrying) return null;
  return (
    <Command.Item
      value="retry"
      forceMount={forceMount}
      onSelect={load.onRetry}
      className={cn(COMMAND_ITEM, 'font-semibold text-link')}
    >
      {uk.shell.search.retry}
    </Command.Item>
  );
}
