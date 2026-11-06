import type { ApplicationListItem } from '@jobflow/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';

import { applicationTableQueryOptions } from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import { useSentFilters } from '@/features/filter-applications';

import { APPLICATION_COLUMNS, INITIAL_SORTING } from './columns';
import { applicationTableFeatures } from './table-features';

export type TableLoad = Readonly<{ failed: boolean; onRetry: () => void }>;

export type ApplicationsTableInstance = ReturnType<typeof useApplicationsTable>['table'];

const NO_ROWS: ApplicationListItem[] = [];

export function useApplicationsTable() {
  const sent = useSentFilters();
  const timeZone = useUserTimeZone();
  const query = useQuery({
    ...applicationTableQueryOptions(sent),
    placeholderData: keepPreviousData,
  });
  const table = useTable({
    features: applicationTableFeatures,
    columns: APPLICATION_COLUMNS,
    data: query.data ?? NO_ROWS,
    getRowId: (application) => application.id,
    initialState: { sorting: INITIAL_SORTING },
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
    timeZone,
  };
}
