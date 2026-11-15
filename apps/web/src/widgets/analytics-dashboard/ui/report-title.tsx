'use client';

import type { SearchSummary } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { formatDayMonthYear } from '@/shared/lib/state-format';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';

import type { SearchScope } from '../model/use-search-scope';

const COPY = uk.analytics;

type SearchPeriod = Readonly<{ search: SearchSummary; timeZone: string }>;

function periodOf({ search, timeZone }: SearchPeriod): string {
  const day = (iso: string) => formatDayMonthYear({ at: new Date(iso), timeZone });
  const end = search.finishedAt === null ? COPY.report.today : day(search.finishedAt);
  return COPY.search.period(day(search.startedAt), end);
}

export type ReportTitleProps = Readonly<{ scope: SearchScope }>;

export function ReportTitle({ scope }: ReportTitleProps) {
  const timeZone = useUserTimeZone();
  const search = scope.searches.data?.items.find(({ id }) => id === scope.searchId);
  return (
    <div className="flex min-w-0 flex-col gap-2 break-inside-avoid">
      <span className="eyebrow text-ink-3">{COPY.report.eyebrow}</span>
      <h2 className={PAGE_TITLE}>{COPY.report.title}</h2>
      <AnimatePresence initial={false}>
        {search && (
          <Fade key={search.id} className="flex flex-wrap items-baseline gap-x-3 text-body-l">
            <span className="font-semibold text-ink">{search.title}</span>
            <span className="text-ink-2 tabular-nums">{periodOf({ search, timeZone })}</span>
          </Fade>
        )}
      </AnimatePresence>
    </div>
  );
}
