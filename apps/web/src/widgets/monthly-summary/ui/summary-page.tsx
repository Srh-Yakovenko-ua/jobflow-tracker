'use client';

import type { YearMonth } from '@jobflow/shared';
import { ArrowLeft } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { monthNameOf, yearOf } from '@/shared/lib/year-month';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';
import { PageSkeleton } from '@/shared/ui/skeleton';

import { type SummaryMonthView, useSummaryPage } from '../model/use-summary-page';
import { SummaryArchive } from './summary-archive';
import { SummaryBlock } from './summary-block';
import { SummaryStateView } from './summary-state-view';

const COPY = uk.summary;

const TEXT_LINK =
  'inline-flex min-h-11 items-center gap-1.5 text-[13.5px] text-link underline-offset-4 transition-colors duration-(--duration-instant) ease-standard hover:text-ink active:text-ink hover:underline active:underline';

type MonthContentProps = Readonly<{
  month: YearMonth;
  view: SummaryMonthView;
  onRetry: () => void;
}>;

function MissingMonth({
  month,
  latestMonth,
}: Readonly<{ month: YearMonth; latestMonth: YearMonth | null }>) {
  const { title, action, hint, hintNoLatest, ...content } = COPY.notFound;
  return (
    <EmptyState
      content={{
        ...content,
        title: title(monthNameOf(month), yearOf(month)),
        hint: latestMonth === null ? hintNoLatest : hint,
      }}
      slots={{
        action: latestMonth !== null && (
          <Link href={`/analytics/summary/${latestMonth}`} className={TEXT_LINK}>
            {action}
          </Link>
        ),
      }}
    />
  );
}

function MonthContent({ month, view, onRetry }: MonthContentProps) {
  switch (view.status) {
    case 'latest':
      return (
        <SummaryStateView
          state={view.state}
          view={{ mode: 'page', regenerate: true }}
          onRetry={onRetry}
        />
      );
    case 'archived':
      return <SummaryBlock summary={view.summary} view={{ mode: 'page', regenerate: false }} />;
    case 'loading':
      return <PageSkeleton />;
    case 'load-failed':
      return <LoadFailedPanel onRetry={onRetry} />;
    case 'not-found':
      return <MissingMonth month={month} latestMonth={view.latestMonth} />;
    default: {
      const unhandled: never = view;
      throw new Error(`Unhandled summary month: ${JSON.stringify(unhandled)}`);
    }
  }
}

export type SummaryPageProps = Readonly<{ month: YearMonth }>;

export function SummaryPage({ month }: SummaryPageProps) {
  const page = useSummaryPage(month);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <Link href="/analytics" className={TEXT_LINK}>
          <ArrowLeft aria-hidden size={16} strokeWidth={1.9} />
          {COPY.page.back}
        </Link>
        <h1 className={PAGE_TITLE}>{COPY.page.heading(monthNameOf(month), yearOf(month))}</h1>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={page.view.status} className="min-w-0">
          <MonthContent month={month} view={page.view} onRetry={page.retry} />
        </Fade>
      </AnimatePresence>
      {page.others.length > 0 && <SummaryArchive items={page.others} />}
    </div>
  );
}
