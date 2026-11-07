import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { DataColumnId, SELECT_COLUMN_ID } from '../model/columns';

export type TableColumnId = DataColumnId | typeof SELECT_COLUMN_ID;

export type ColumnAlign = 'start' | 'end';

type ColumnLook = Readonly<{ width: string; align: ColumnAlign }>;

export const COLUMN_LOOK: Record<TableColumnId, ColumnLook> = {
  select: { width: 'w-12', align: 'start' },
  vacancy: { width: 'w-auto', align: 'start' },
  stage: { width: 'w-32', align: 'start' },
  score: { width: 'w-22', align: 'end' },
  salary: { width: 'w-32', align: 'end' },
  source: { width: 'w-26', align: 'start' },
  appliedAt: { width: 'w-32', align: 'start' },
  lastEventAt: { width: 'w-34', align: 'start' },
  daysInStage: { width: 'w-40', align: 'end' },
};

export const TABLE_LOOK = {
  frame: 'mx-auto flex max-w-[1388px] flex-col overflow-hidden rounded-2xl bg-surface shadow-e1',
  scroller: 'max-h-[calc(100dvh-16rem)] overflow-auto overscroll-contain',
  table: 'w-full min-w-280 table-fixed border-separate border-spacing-0',
  cell: 'border-b border-line-soft px-1.5 first:pl-4 last:pr-4 [&_label]:min-h-0',
  head: 'sticky top-0 z-10 h-8.5 bg-surface-2 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-3 uppercase',
  row: 'h-11.5 cursor-pointer text-[13px] transition-colors duration-(--duration-instant) ease-standard hover:bg-surface-2 data-[state=selected]:bg-accent-tint',
  end: 'text-right',
  muted: 'text-ink-3',
} as const;

export const TOOLBAR_BUTTON = {
  variant: 'secondary',
  size: 'sm',
  className: TOUCH_HEIGHT,
} as const;
