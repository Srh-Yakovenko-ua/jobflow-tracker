import type { ApplicationListItem } from '@jobflow/shared';
import type { Column } from '@tanstack/react-table';

import { uk } from '@/shared/i18n';

import { isDataColumnId, SELECT_COLUMN_ID } from '../model/columns';
import type { ApplicationTableFeatures } from '../model/table-features';
import type { ApplicationsTableInstance } from '../model/use-applications-table';
import { useTableVirtualizer } from '../model/use-table-virtualizer';
import { type HeaderSort, SelectAllHeader, type SelectAllState, SortHeader } from './table-head';
import { TABLE_LOOK, type TableColumnId } from './table-look';
import { TableRow } from './table-row';

const COPY = uk.applicationsTable;

export type TableGridProps = Readonly<{ table: ApplicationsTableInstance; timeZone: string }>;

type SortSource = Readonly<{
  column: Column<ApplicationTableFeatures, ApplicationListItem>;
  multi: boolean;
}>;

function sortOf({ column, multi }: SortSource): HeaderSort {
  const direction = column.getIsSorted();
  return {
    direction,
    rank: multi && direction !== false ? column.getSortIndex() + 1 : null,
    onToggle: column.getToggleSortingHandler(),
  };
}

function selectAllOf(table: ApplicationsTableInstance): SelectAllState {
  if (table.getIsAllRowsSelected()) {
    return true;
  }
  return table.getIsSomeRowsSelected() ? 'indeterminate' : false;
}

function Spacer({ height, span }: Readonly<{ height: number; span: number }>) {
  return (
    <tr aria-hidden>
      <td colSpan={span} className="p-0" style={{ height }} />
    </tr>
  );
}

function shownColumnIdsOf(table: ApplicationsTableInstance): TableColumnId[] {
  return table
    .getVisibleLeafColumns()
    .flatMap((column) =>
      column.id === SELECT_COLUMN_ID || isDataColumnId(column.id) ? [column.id] : [],
    );
}

function TableHeadRow({ table }: Readonly<{ table: ApplicationsTableInstance }>) {
  const multi = table.state.sorting.length > 1;
  return (
    <tr aria-rowindex={1}>
      {table.getVisibleLeafColumns().map((column) => {
        if (column.id === SELECT_COLUMN_ID) {
          return (
            <SelectAllHeader
              key={column.id}
              checked={selectAllOf(table)}
              onToggle={(checked) => {
                table.toggleAllRowsSelected(checked);
              }}
            />
          );
        }
        return isDataColumnId(column.id) ? (
          <SortHeader key={column.id} id={column.id} sort={sortOf({ column, multi })} />
        ) : null;
      })}
    </tr>
  );
}

export function TableGrid({ table, timeZone }: TableGridProps) {
  const { rows } = table.getRowModel();
  const { scrollRef, items, before, after } = useTableVirtualizer({
    ids: rows.map((row) => row.id),
  });
  const columns = shownColumnIdsOf(table);
  return (
    <div ref={scrollRef} data-table-scroll className={TABLE_LOOK.scroller}>
      <table aria-label={COPY.label} aria-rowcount={rows.length + 1} className={TABLE_LOOK.table}>
        <thead>
          <TableHeadRow table={table} />
        </thead>
        <tbody>
          {before > 0 && <Spacer height={before} span={columns.length} />}
          {items.flatMap((item) => {
            const row = rows[item.index];
            if (row === undefined) return [];
            return (
              <TableRow
                key={row.id}
                application={row.original}
                view={{ columns, selected: row.getIsSelected(), index: item.index, timeZone }}
                actions={{
                  onSelect: (selected) => {
                    row.toggleSelected(selected);
                  },
                }}
              />
            );
          })}
          {after > 0 && <Spacer height={after} span={columns.length} />}
        </tbody>
      </table>
    </div>
  );
}
