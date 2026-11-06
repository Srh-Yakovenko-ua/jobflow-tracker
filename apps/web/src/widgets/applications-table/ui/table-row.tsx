import type { ApplicationListItem } from '@jobflow/shared';
import type { MouseEvent } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/checkbox';

import { SELECT_COLUMN_ID } from '../model/columns';
import { ROW_LINK, TABLE_CELLS } from './table-cells';
import { COLUMN_LOOK, TABLE_LOOK, type TableColumnId } from './table-look';

const COPY = uk.applicationsTable;

const ROW_SKIP = 'a, button, label, input, [data-row-skip]';

export type TableRowView = Readonly<{
  columns: readonly TableColumnId[];
  selected: boolean;
  index: number;
  timeZone: string;
}>;

export type TableRowProps = Readonly<{
  application: ApplicationListItem;
  view: TableRowView;
  actions: { onSelect: (selected: boolean) => void };
}>;

function openRow(event: MouseEvent<HTMLTableRowElement>) {
  if (event.target instanceof Element && event.target.closest(ROW_SKIP) !== null) {
    return;
  }
  const link = event.currentTarget.querySelector<HTMLAnchorElement>(ROW_LINK);
  link?.focus({ preventScroll: true });
  link?.click();
}

export function TableRow({ application, view, actions }: TableRowProps) {
  return (
    <tr
      aria-rowindex={view.index + 2}
      data-state={view.selected ? 'selected' : undefined}
      className={TABLE_LOOK.row}
      onClick={openRow}
    >
      {view.columns.map((id) => {
        if (id === SELECT_COLUMN_ID) {
          return (
            <td key={id} data-row-skip className={TABLE_LOOK.cell}>
              <Checkbox
                checked={view.selected}
                onCheckedChange={(next) => {
                  actions.onSelect(next === true);
                }}
                label={<span className="sr-only">{COPY.select.row(application.company)}</span>}
              />
            </td>
          );
        }
        const Cell = TABLE_CELLS[id];
        return (
          <td
            key={id}
            className={cn(TABLE_LOOK.cell, COLUMN_LOOK[id].align === 'end' && TABLE_LOOK.end)}
          >
            <Cell application={application} timeZone={view.timeZone} />
          </td>
        );
      })}
    </tr>
  );
}
