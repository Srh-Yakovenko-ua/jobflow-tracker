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

import { APPLICATION_COLUMNS, INITIAL_SORTING } from './columns';
import { applicationTableFeatures } from './table-features';

export type TableLoad = Readonly<{ failed: boolean; onRetry: () => void }>;

export type ApplicationsTableInstance = ReturnType<typeof useApplicationsTable>['table'];

type FiltersSelection = Readonly<{ filtersHash: string; rows: RowSelectionState }>;

const NO_ROWS: ApplicationListItem[] = [];

function useSelectionPerFilters(sent: ApplicationFilters) {
  const filtersHash = hashKey(applicationKeys.table(sent));
  const [selection, setSelection] = useState<FiltersSelection>({ filtersHash, rows: {} });
  if (selection.filtersHash !== filtersHash) {
    setSelection({ filtersHash, rows: {} });
  }
  const onChange: OnChangeFn<RowSelectionState> = (updater) => {
    setSelection((prev) => ({ ...prev, rows: functionalUpdate(updater, prev.rows) }));
  };
  return { rows: selection.rows, onChange };
}

export function useApplicationsTable() {
  const sent = useSentFilters();
  const timeZone = useUserTimeZone();
  const query = useQuery({
    ...applicationTableQueryOptions(sent),
    placeholderData: keepPreviousData,
  });
  const everyStage = useQuery({
    ...applicationTableQueryOptions({ ...sent, stage: undefined }),
    placeholderData: keepPreviousData,
  });
  const selection = useSelectionPerFilters(sent);
  const table = useTable({
    features: applicationTableFeatures,
    columns: APPLICATION_COLUMNS,
    data: query.data ?? NO_ROWS,
    getRowId: (application) => application.id,
    initialState: { sorting: INITIAL_SORTING },
    state: { rowSelection: selection.rows },
    onRowSelectionChange: selection.onChange,
  });
  const load: TableLoad = {
    failed: query.isError && !query.isFetching,
    onRetry: () => {
      void query.refetch();
    },
  };
  const filtered =
    query.isPlaceholderData || Object.values(sent).some((value) => value !== undefined);
  return {
    table,
    loaded: query.data !== undefined,
    load,
    search: { filtered, q: sent.q },
    stageRows: everyStage.data,
    timeZone,
  };
}
