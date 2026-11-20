import type { ApplicationFilters, ApplicationListItem } from '@jobflow/shared';
import { hashKey, keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  functionalUpdate,
  type OnChangeFn,
  type RowSelectionState,
  useTable,
} from '@tanstack/react-table';
import { useState } from 'react';

import { applicationKeys, applicationTableQueryOptions } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import { useSentFilters } from '@/features/filter-applications';
import { type SectionLoad, sectionLoadOf } from '@/shared/lib/section-load';

import { APPLICATION_COLUMNS, INITIAL_SORTING } from './columns';
import { applicationTableFeatures } from './table-features';

export type StageCounts = Readonly<{
  rows: readonly ApplicationListItem[] | undefined;
  load: SectionLoad;
}>;

export type ApplicationsTableInstance = ReturnType<typeof useApplicationsTable>['table'];

type FiltersSelection = Readonly<{ filtersHash: string; rows: RowSelectionState }>;

const NO_ROWS: ApplicationListItem[] = [];

type SelectionSource = Readonly<{
  sent: ApplicationFilters;
  loaded: readonly ApplicationListItem[] | undefined;
}>;

function loadedPicksOf(
  picks: RowSelectionState,
  loaded: readonly ApplicationListItem[],
): RowSelectionState | undefined {
  const loadedIds = new Set(loaded.map((application) => application.id));
  const kept = Object.entries(picks).filter(([id]) => loadedIds.has(id));
  return kept.length === Object.keys(picks).length ? undefined : Object.fromEntries(kept);
}

function useSelectionPerFilters({ sent, loaded }: SelectionSource) {
  const filtersHash = hashKey(applicationKeys.table(sent));
  const [selection, setSelection] = useState<FiltersSelection>({ filtersHash, rows: {} });
  if (selection.filtersHash !== filtersHash) {
    setSelection({ filtersHash, rows: {} });
  } else if (loaded !== undefined) {
    const pruned = loadedPicksOf(selection.rows, loaded);
    if (pruned !== undefined) setSelection({ filtersHash, rows: pruned });
  }
  const onChange: OnChangeFn<RowSelectionState> = (updater) => {
    setSelection((prev) => ({ ...prev, rows: functionalUpdate(updater, prev.rows) }));
  };
  return { rows: selection.rows, onChange };
}

type StageCountsInput = Readonly<{ sent: ApplicationFilters; listFailed: boolean }>;

function useStageCounts({ sent, listFailed }: StageCountsInput): StageCounts {
  const everyStage = useQuery({
    ...applicationTableQueryOptions({ ...sent, stage: undefined }),
    placeholderData: keepPreviousData,
  });
  const load = sectionLoadOf(everyStage);
  return {
    rows: everyStage.data,
    load: { ...load, failed: (load.failed || load.stale) && !listFailed },
  };
}

export function useApplicationsTable() {
  const sent = useSentFilters();
  const timeZone = useUserTimeZone();
  const query = useQuery({
    ...applicationTableQueryOptions(sent),
    placeholderData: keepPreviousData,
  });
  const load = sectionLoadOf(query);
  const stageCounts = useStageCounts({ sent, listFailed: load.failed || load.stale });
  const selection = useSelectionPerFilters({ sent, loaded: query.data });
  const table = useTable({
    features: applicationTableFeatures,
    columns: APPLICATION_COLUMNS,
    data: query.data ?? NO_ROWS,
    getRowId: (application) => application.id,
    initialState: { sorting: INITIAL_SORTING },
    state: { rowSelection: selection.rows },
    onRowSelectionChange: selection.onChange,
  });
  const filtered =
    query.isPlaceholderData || Object.values(sent).some((value) => value !== undefined);
  return {
    table,
    loaded: query.data !== undefined,
    load,
    search: { filtered, q: sent.q },
    stageCounts,
    timeZone,
  };
}
