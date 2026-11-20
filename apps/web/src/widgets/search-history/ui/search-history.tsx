'use client';

import type { SearchSummary } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';

import { dashboardHrefOf, searchDatesOf, searchesQueryOptions } from '@/entities/search';
import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { buttonLinkClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { ROW } from '@/shared/ui/list-stagger';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { PAGE_TITLE } from '@/shared/ui/page-title';
import { CardSkeleton } from '@/shared/ui/skeleton';
import { StaggeredList } from '@/shared/ui/staggered-list';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

const COPY = uk.searches.history;

const DOT = ' · ';

function metaOf(search: SearchSummary, timeZone: string): string {
  const dates = searchDatesOf(search, timeZone);
  return search.outcome === null ? dates : [dates, COPY.outcomes[search.outcome]].join(DOT);
}

function totalsOf(search: SearchSummary): string {
  return [
    COPY.applications(search.applications),
    COPY.interviews(search.interviews),
    COPY.offers(search.offers),
    COPY.daysToOffer(search.daysToOffer),
    COPY.days(search.days),
  ].join(DOT);
}

type SearchRowProps = Readonly<{ search: SearchSummary; timeZone: string }>;

function SearchRow({ search, timeZone }: SearchRowProps) {
  return (
    <motion.li
      variants={ROW}
      className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-e1"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="font-display text-[18px] leading-[1.25] wrap-break-word">{search.title}</h2>
        <p className="text-[13px] leading-[1.45] text-ink-3 tabular-nums">
          {metaOf(search, timeZone)}
        </p>
        <p className="text-[14px] leading-[1.5] text-ink-2 tabular-nums">{totalsOf(search)}</p>
      </div>
      <Link
        href={dashboardHrefOf(search.id)}
        className={cn(buttonLinkClasses({ variant: 'secondary', size: 'sm' }), TOUCH_HEIGHT)}
      >
        {COPY.dashboard}
      </Link>
    </motion.li>
  );
}

function HistoryBody() {
  const searches = useQuery(searchesQueryOptions());
  const timeZone = useUserTimeZone();
  const load = sectionLoadOf(searches);
  if (load.failed || load.stale) {
    return (
      <div className="animate-fade-in">
        <LoadFailedPanel load={load} />
      </div>
    );
  }
  if (searches.data === undefined) {
    return (
      <LoadingRegion className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
      </LoadingRegion>
    );
  }
  const archived = searches.data.items.filter((search) => search.status === 'archived');
  if (archived.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState content={COPY.empty} />
      </div>
    );
  }
  return (
    <StaggeredList label={COPY.title} className="flex flex-col gap-3">
      {archived.map((search) => (
        <SearchRow key={search.id} search={search} timeZone={timeZone} />
      ))}
    </StaggeredList>
  );
}

export function SearchHistory() {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className={PAGE_TITLE}>{COPY.title}</h1>
      <HistoryBody />
    </div>
  );
}
