'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { boardQueryOptions, SILENT_ONLY, silentCountOf } from '@/entities/application';
import { remindersQueryOptions } from '@/entities/reminder';

import { snoozedCountOf } from '../lib/silent-rows';

export function useSilentCount(): number {
  const [now] = useState(() => new Date());
  const board = useQuery(boardQueryOptions(SILENT_ONLY)).data;
  const reminders = useQuery(remindersQueryOptions()).data?.items ?? [];
  if (board === undefined) return 0;
  return silentCountOf(board) - snoozedCountOf({ board, reminders, now });
}
