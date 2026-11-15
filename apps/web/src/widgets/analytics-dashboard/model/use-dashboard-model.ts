'use client';

import { useState } from 'react';

import { useSilenceDays } from '@/entities/user';

import { dashboardViewOf } from './dashboard-view';
import { useDashboardQueries } from './use-dashboard-queries';
import { useForecastWhatIf } from './use-forecast-what-if';
import { useSearchScope } from './use-search-scope';

export function useDashboardModel(initialId?: string) {
  const scope = useSearchScope(initialId);
  const [byReason, setByReason] = useState(false);
  const { whatIf, sent, actions } = useForecastWhatIf(scope.selectedId);
  const queries = useDashboardQueries({
    ...scope,
    split: byReason ? 'reason' : undefined,
    whatIf: sent,
  });
  const silenceDays = useSilenceDays();
  return {
    scope,
    queries,
    view: dashboardViewOf({ queries, searches: scope.searches }),
    silenceDays,
    sankey: {
      searchId: scope.searchId,
      byReason,
      toggle: () => {
        setByReason((shown) => !shown);
      },
    },
    forecast: { value: whatIf, actions },
  };
}

export type DashboardModel = ReturnType<typeof useDashboardModel>;
