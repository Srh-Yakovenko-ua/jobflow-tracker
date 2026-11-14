'use client';

import type { FunnelKpis } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useState } from 'react';

import { useSilenceDays } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';

import { searchWeeks } from '../lib/kpi-values';
import { dashboardViewOf } from '../model/dashboard-view';
import { useDashboardQueries } from '../model/use-dashboard-queries';
import { useForecastWhatIf } from '../model/use-forecast-what-if';
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
        <h2 className={PAGE_TITLE}>{COPY.heading}</h2>
      </div>
      <SearchSelect scope={scope} />
    </div>
  );
}

export function AnalyticsDashboard() {
  const scope = useSearchScope();
  const [byReason, setByReason] = useState(false);
  const { whatIf, sent, actions } = useForecastWhatIf(scope.selectedId);
  const queries = useDashboardQueries({
    ...scope,
    split: byReason ? 'reason' : undefined,
    whatIf: sent,
  });
  const view = dashboardViewOf({ queries, searches: scope.searches });
  const silenceDays = useSilenceDays();
  const sankey = {
    searchId: scope.searchId,
    byReason,
    toggle: () => {
      setByReason((shown) => !shown);
    },
  };
  return (
    <div className="flex min-w-0 flex-col gap-10">
      <DashboardHeader kpis={view.kpis} scope={scope} />
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={view.lowData ? 'low' : 'full'}>
          {view.kpis !== undefined && view.lowData ? (
            <LowDataDashboard kpis={view.kpis} />
          ) : (
            <DashboardBlocks
              view={view}
              silenceDays={silenceDays}
              sankey={sankey}
              forecast={{ value: whatIf, actions }}
            />
          )}
        </Fade>
      </AnimatePresence>
    </div>
  );
}
