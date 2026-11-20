'use client';

import { useQuery } from '@tanstack/react-query';

import { boardQueryOptions, SILENT_ONLY, silentCountOf } from '@/entities/application';
import { remindersQueryOptions } from '@/entities/reminder';
import { useQueryNow } from '@/shared/lib/use-query-now';

import { snoozedCountOf } from '../lib/silent-rows';

export function useSilentCount(): number {
  const board = useQuery(boardQueryOptions(SILENT_ONLY)).data;
  const remindersQuery = useQuery(remindersQueryOptions());
  const now = useQueryNow(remindersQuery);
  const reminders = remindersQuery.data?.items ?? [];
  if (board === undefined) return 0;
  return silentCountOf(board) - snoozedCountOf({ board, reminders, now });
}
