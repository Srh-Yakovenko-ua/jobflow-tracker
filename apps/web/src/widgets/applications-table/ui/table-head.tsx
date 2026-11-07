import type { SortDirection } from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { AriaAttributes } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/checkbox';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { DataColumnId } from '../model/columns';
import { COLUMN_LOOK, TABLE_LOOK } from './table-look';

const COPY = uk.applicationsTable;

export const SELECT_ALL_ID = 'applications-select-all';

export type HeaderSort = Readonly<{
  direction: false | SortDirection;
  rank: number | null;
  onToggle: ((event: unknown) => void) | undefined;
}>;

export type SortHeaderProps = Readonly<{ id: DataColumnId; sort: HeaderSort }>;

export type SelectAllState = boolean | 'indeterminate';

export type SelectAllHeaderProps = Readonly<{
  checked: SelectAllState;
  onToggle: (checked: boolean) => void;
}>;

const ARIA_SORT: Record<SortDirection, AriaAttributes['aria-sort']> = {
  asc: 'ascending',
  desc: 'descending',
};

function ariaSortOf(sort: HeaderSort): AriaAttributes['aria-sort'] {
  const primary = sort.rank === null || sort.rank === 1;
  return sort.direction === false || !primary ? undefined : ARIA_SORT[sort.direction];
}

export function SelectAllHeader({ checked, onToggle }: SelectAllHeaderProps) {
  return (
    <th scope="col" className={cn(TABLE_LOOK.cell, TABLE_LOOK.head, COLUMN_LOOK.select.width)}>
      <Checkbox
        id={SELECT_ALL_ID}
        checked={checked}
        onCheckedChange={(next) => {
          onToggle(next === true);
        }}
        label={<span className="sr-only">{COPY.select.all}</span>}
      />
    </th>
  );
}

export function SortHeader({ id, sort }: SortHeaderProps) {
  const look = COLUMN_LOOK[id];
  const Arrow = sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={ariaSortOf(sort)}
      className={cn(TABLE_LOOK.cell, TABLE_LOOK.head, look.width)}
    >
      <button
        type="button"
        onClick={sort.onToggle}
        className={cn(
          'touch-target flex w-full items-center gap-1.5 rounded-xs uppercase select-none hover:text-ink focus-visible:focus-ring',
          TOUCH_HEIGHT,
          look.align === 'end' && 'justify-end',
          sort.direction !== false && 'text-ink-2',
        )}
      >
        <span className="truncate">{COPY.columns[id].header}</span>
        <Arrow
          aria-hidden
          size={12}
          className={cn('flex-none', sort.direction === false && 'opacity-25')}
        />
        {sort.rank !== null && (
          <span className="flex-none rounded-[4px] bg-accent-tint px-1 py-px text-[9px] font-bold tracking-normal text-accent-ink tabular-nums">
            <span aria-hidden>{sort.rank}</span>
            <span className="sr-only">{COPY.sortRank(sort.rank)}</span>
          </span>
        )}
      </button>
    </th>
  );
}
