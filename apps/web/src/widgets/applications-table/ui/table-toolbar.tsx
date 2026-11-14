import type { ApplicationListItem } from '@jobflow/shared';
import { Download } from 'lucide-react';

import {
  FilterChipsRow,
  FilterMenus,
  FilterSearch,
  StageChips,
  ViewSwitch,
} from '@/features/filter-applications';
import { uk } from '@/shared/i18n';
import { saveTextFile } from '@/shared/lib/save-text-file';
import { Button } from '@/shared/ui/button';

import { tableCsvFileOf } from '../lib/table-csv';
import { dataColumnIdsOf } from '../model/columns';
import type { ApplicationsTableInstance } from '../model/use-applications-table';
import { ColumnsMenu } from './columns-menu';
import { TOOLBAR_BUTTON } from './table-look';

const COPY = uk.applicationsTable.csv;

export type TableToolbarProps = Readonly<{
  table: ApplicationsTableInstance;
  timeZone: string;
  view: { rows: boolean };
  stageRows: readonly ApplicationListItem[] | undefined;
}>;

function CsvButton({ table, timeZone }: Pick<TableToolbarProps, 'table' | 'timeZone'>) {
  return (
    <Button
      {...TOOLBAR_BUTTON}
      aria-label={COPY.label}
      icon={<Download aria-hidden size={15} />}
      onClick={() => {
        saveTextFile(
          tableCsvFileOf({
            applications: table.getRowModel().rows.map((row) => row.original),
            columns: dataColumnIdsOf(table.getVisibleLeafColumns()),
            timeZone,
            now: new Date(),
          }),
        );
      }}
    >
      {COPY.button}
    </Button>
  );
}

export function TableToolbar({ table, timeZone, view, stageRows }: TableToolbarProps) {
  return (
    <div className="flex flex-col gap-1 px-4 pt-3.5 pb-1.5 shadow-[inset_0_-1px_0_var(--line-soft)]">
      <div className="flex flex-wrap items-center gap-2.5 pb-2">
        <FilterSearch copy={uk.applicationsTable.search} />
        {stageRows !== undefined && <StageChips applications={stageRows} />}
        <FilterMenus />
        <span className="hidden flex-1 sm:block" />
        {view.rows && <ColumnsMenu table={table} />}
        {view.rows && <CsvButton table={table} timeZone={timeZone} />}
        <ViewSwitch current="table" />
      </div>
      {view.rows && <FilterChipsRow />}
    </div>
  );
}
