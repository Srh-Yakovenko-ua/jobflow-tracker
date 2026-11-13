'use client';

import type { FunnelKpis } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { useSilenceDays } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';

import { searchWeeks } from '../lib/kpi-values';
import { dashboardViewOf } from '../model/dashboard-view';
import { useDashboardQueries } from '../model/use-dashboard-queries';
import { type SearchScope, useSearchScope } from '../model/use-search-scope';
import { DashboardBlocks } from './dashboard-blocks';
import { LowDataDashboard } from './low-data-dashboard';
import { SearchSelect } from './search-select';

const COPY = uk.analytics;

type DashboardHeaderProps = Readonly<{ kpis: FunnelKpis | undefined; scope: SearchScope }>;

function DashboardHeader({ kpis, scope }: DashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="eyebrow text-ink-3">
          {kpis === undefined ? COPY.eyebrow : COPY.eyebrowWeeks(searchWeeks(kpis.daysInSearch))}
        </span>
        <h2 className="font-display text-[clamp(26px,3.5vw,36px)] leading-[1.03] font-medium tracking-[-0.036em] text-ink">
          {COPY.heading}
        </h2>
      </div>
      <SearchSelect scope={scope} />
    </div>
  );
}

export function AnalyticsDashboard() {
  const scope = useSearchScope();
  const queries = useDashboardQueries(scope);
  const view = dashboardViewOf({ queries, searches: scope.searches });
  const silenceDays = useSilenceDays();
  return (
    <div className="flex min-w-0 flex-col gap-10">
      <DashboardHeader kpis={view.kpis} scope={scope} />
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={view.lowData ? 'low' : 'full'}>
          {view.kpis !== undefined && view.lowData ? (
            <LowDataDashboard kpis={view.kpis} />
          ) : (
            <DashboardBlocks view={view} silenceDays={silenceDays} />
          )}
        </Fade>
      </AnimatePresence>
    </div>
  );
}
