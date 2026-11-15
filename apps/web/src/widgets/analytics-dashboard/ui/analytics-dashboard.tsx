'use client';

import { AnimatePresence } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { ShareFunnelButton } from '@/features/share-funnel';
import { uk } from '@/shared/i18n';
import { searchWeeks } from '@/shared/lib/search-weeks';
import { buttonLinkClasses } from '@/shared/ui/button';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';

import type { DashboardView } from '../model/dashboard-view';
import { useDashboardModel } from '../model/use-dashboard-model';
import type { SearchScope } from '../model/use-search-scope';
import { DashboardBlocks } from './dashboard-blocks';
import { LowDataDashboard } from './low-data-dashboard';
import { SearchSelect } from './search-select';

const COPY = uk.analytics;

const REPORT_PATH = '/analytics/report';

function reportHrefOf({ selectedId }: SearchScope): string {
  return selectedId === undefined ? REPORT_PATH : `${REPORT_PATH}?period=${selectedId}`;
}

type DashboardHeaderProps = Readonly<{ view: DashboardView; scope: SearchScope }>;

function DashboardHeader({ view: { kpis, story }, scope }: DashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="eyebrow text-ink-3">
          {kpis === undefined ? COPY.eyebrow : COPY.eyebrowWeeks(searchWeeks(kpis.daysInSearch))}
        </span>
        <h2 className={PAGE_TITLE}>{COPY.heading}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={reportHrefOf(scope)}
          className={buttonLinkClasses({ variant: 'secondary', size: 'md' })}
        >
          {COPY.report.link}
        </Link>
        {story && <ShareFunnelButton story={story} />}
        <SearchSelect scope={scope} />
      </div>
    </div>
  );
}

export type AnalyticsDashboardProps = Readonly<{ summary?: ReactNode }>;

export function AnalyticsDashboard({ summary }: AnalyticsDashboardProps = {}) {
  const model = useDashboardModel();
  const { scope, view } = model;
  return (
    <div className="flex min-w-0 flex-col gap-10">
      <DashboardHeader view={view} scope={scope} />
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={view.lowData ? 'low' : 'full'}>
          {view.kpis !== undefined && view.lowData ? (
            <LowDataDashboard
              kpis={view.kpis}
              view={{ active: scope.searchId === scope.activeId }}
            />
          ) : (
            <DashboardBlocks model={model} layout="dashboard" />
          )}
        </Fade>
      </AnimatePresence>
      {summary}
    </div>
  );
}
