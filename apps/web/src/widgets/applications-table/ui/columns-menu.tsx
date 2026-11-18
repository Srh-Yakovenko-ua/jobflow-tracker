import { Columns3 } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { TOOLBAR_BUTTON } from '@/shared/ui/toolbar-button';

import { DATA_COLUMN_IDS } from '../model/columns';
import type { ApplicationsTableInstance } from '../model/use-applications-table';

const COPY = uk.applicationsTable;

export type ColumnsMenuProps = Readonly<{ table: ApplicationsTableInstance }>;

function hideableColumnsOf(table: ApplicationsTableInstance) {
  return DATA_COLUMN_IDS.flatMap((id) => {
    const column = table.getColumn(id);
    return column?.getCanHide() === true ? [{ id, column, visible: column.getIsVisible() }] : [];
  });
}

export function ColumnsMenu({ table }: ColumnsMenuProps) {
  const columns = hideableColumnsOf(table);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button {...TOOLBAR_BUTTON} icon={<Columns3 aria-hidden size={15} />}>
          {COPY.columnsMenu.trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={COPY.columnsMenu.label}
        className="flex w-53.5 max-w-[calc(100vw-16px)] flex-col p-1.5"
      >
        {columns.map(({ id, column, visible }) => (
          <Checkbox
            key={id}
            checked={visible}
            onCheckedChange={(next) => {
              column.toggleVisibility(next === true);
            }}
            label={COPY.columns[id].menu}
            className="ml-2"
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}
