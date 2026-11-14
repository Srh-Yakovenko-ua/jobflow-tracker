'use client';

import type { ApplicationFilters } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { FirstRunState } from '@/entities/application';
import { ApplicationFiltersProvider, FiltersEmptyState } from '@/features/filter-applications';
import { uk } from '@/shared/i18n';
import { LoadFailedAlert } from '@/shared/ui/banner';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { TableSkeleton } from '@/shared/ui/skeleton';

import { useApplicationsTable } from '../model/use-applications-table';
import { BulkBar } from './bulk-bar';
import { TableGrid } from './table-grid';
import { TABLE_LOOK } from './table-look';
import { TableToolbar } from './table-toolbar';

const COPY = uk.applicationsTable;

function TableFrame({ children }: Readonly<{ children: ReactNode }>) {
  return <section className={TABLE_LOOK.frame}>{children}</section>;
}

function TableLoading({ failed, onRetry }: Readonly<{ failed: boolean; onRetry: () => void }>) {
  if (failed) {
    return (
      <div className="max-w-120 animate-fade-in p-4">
        <LoadFailedPanel onRetry={onRetry} />
      </div>
    );
  }
  return (
    <LoadingRegion>
      <TableSkeleton />
    </LoadingRegion>
  );
}

function TableContent() {
  const { table, loaded, load, search, stageRows, timeZone } = useApplicationsTable();
  if (!loaded) {
    return (
      <TableFrame>
        <TableToolbar
          table={table}
          timeZone={timeZone}
          view={{ rows: false }}
          stageRows={stageRows}
        />
        <TableLoading failed={load.failed} onRetry={load.onRetry} />
      </TableFrame>
    );
  }
  const { rows } = table.getRowModel();
  if (rows.length === 0 && !search.filtered) {
    return (
      <div className="max-w-120 animate-fade-in">
        <FirstRunState />
      </div>
    );
  }
  const picked = rows.filter((row) => row.getIsSelected()).map((row) => row.original);
  return (
    <TableFrame>
      <TableToolbar
        table={table}
        timeZone={timeZone}
        view={{ rows: rows.length > 0 }}
        stageRows={stageRows}
      />
      {load.failed && <LoadFailedAlert className="px-4 py-2" onRetry={load.onRetry} />}
      {picked.length > 0 && (
        <BulkBar
          picked={picked}
          actions={{
            onDone: () => {
              table.resetRowSelection();
            },
          }}
        />
      )}
      {rows.length === 0 ? (
        <div className="p-4">
          <FiltersEmptyState q={search.q} />
        </div>
      ) : (
        <TableGrid table={table} timeZone={timeZone} />
      )}
      <p className="px-4 py-3 text-[12px] text-ink-3 tabular-nums shadow-[inset_0_1px_0_var(--line-soft)]">
        {COPY.total(rows.length)}
      </p>
    </TableFrame>
  );
}

export type ApplicationsTableProps = Readonly<{ initial: { filters?: ApplicationFilters } }>;

export function ApplicationsTable({ initial }: ApplicationsTableProps) {
  return (
    <ApplicationFiltersProvider initial={initial.filters ?? {}}>
      <TableContent />
    </ApplicationFiltersProvider>
  );
}
