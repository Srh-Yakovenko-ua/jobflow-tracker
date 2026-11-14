'use client';

import type { SummaryArchive, SummaryArchiveItem, YearMonth } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { summaryArchiveQueryOptions } from '@/entities/summary';

import type { SummaryState } from '../lib/summary-state';
import { useMonthlySummary } from './use-monthly-summary';

export type SummaryMonthView =
  | Readonly<{ status: 'latest'; state: SummaryState }>
  | Readonly<{ status: 'archived'; summary: SummaryArchiveItem }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'load-failed' }>
  | Readonly<{ status: 'not-found'; latestMonth: YearMonth | null }>;

type ArchiveRead = Readonly<{ data: SummaryArchive | undefined; isError: boolean }>;

type MonthViewInput = Readonly<{
  month: YearMonth;
  monthly: Readonly<{ state: SummaryState; latestMonth: YearMonth | null }>;
  archive: ArchiveRead;
}>;

function archivedViewOf({ month, archive }: MonthViewInput): SummaryMonthView | null {
  const summary = archive.data?.items.find((item) => item.month === month);
  if (summary !== undefined) return { status: 'archived', summary };
  if (archive.data === undefined) return { status: archive.isError ? 'load-failed' : 'loading' };
  return null;
}

function monthViewOf(input: MonthViewInput): SummaryMonthView {
  const { month, monthly } = input;
  const { state, latestMonth } = monthly;
  if (state.status === 'load-failed') return archivedViewOf(input) ?? state;
  if (state.status === 'loading') return state;
  if (latestMonth === month) return { status: 'latest', state };
  return archivedViewOf(input) ?? { status: 'not-found', latestMonth };
}

export function useSummaryPage(month: YearMonth) {
  const monthly = useMonthlySummary();
  const archive = useQuery(summaryArchiveQueryOptions());
  return {
    view: monthViewOf({
      month,
      monthly: { state: monthly.state, latestMonth: monthly.latest?.summary?.month ?? null },
      archive,
    }),
    others: archive.data?.items.filter((item) => item.month !== month) ?? [],
    retry: () => {
      monthly.retry();
      void archive.refetch();
    },
  };
}

export type SummaryPageState = ReturnType<typeof useSummaryPage>;
