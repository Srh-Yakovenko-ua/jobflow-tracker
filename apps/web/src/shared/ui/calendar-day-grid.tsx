'use client';

import type { KeyboardEvent, RefCallback } from 'react';

import { uk } from '@/shared/i18n';
import {
  addDays,
  addMonths,
  addYears,
  isOutsideBounds,
  type MonthCell,
  monthGrid,
  monthOf,
  weekdayOf,
} from '@/shared/lib/calendar-month';
import { cn } from '@/shared/lib/cn';

const COPY = uk.calendar;

export type CalendarDays = Readonly<{
  today: string;
  min?: string;
  max?: string;
  marked?: Readonly<Record<string, number>>;
}>;

export type CalendarGridFocus = Readonly<{
  day: string;
  target: RefCallback<HTMLButtonElement>;
}>;

export type CalendarGridActions = Readonly<{
  onPick: (day: string) => void;
  onMove: (day: string) => void;
}>;

export type CalendarDayGridProps = Readonly<{
  value: string | null;
  days: CalendarDays;
  focus: CalendarGridFocus;
  actions: CalendarGridActions;
}>;

type DayMove = (day: string) => string;

type DayLook = Readonly<{ selected: boolean; today: boolean; disabled: boolean; marks: number }>;

const WEEK = 7;

const DENSE_AFTER = 3;

const MOVES: Partial<Record<string, DayMove>> = {
  ArrowLeft: (day) => addDays(day, -1),
  ArrowRight: (day) => addDays(day, 1),
  ArrowUp: (day) => addDays(day, -WEEK),
  ArrowDown: (day) => addDays(day, WEEK),
  Home: (day) => addDays(day, -weekdayOf(day)),
  End: (day) => addDays(day, WEEK - 1 - weekdayOf(day)),
  PageUp: (day) => addMonths(day, -1),
  PageDown: (day) => addMonths(day, 1),
};

const SHIFT_MOVES: Partial<Record<string, DayMove>> = {
  PageUp: (day) => addYears(day, -1),
  PageDown: (day) => addYears(day, 1),
};

const DAY_LABEL = new Intl.DateTimeFormat(uk.locale, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const WEEKDAY =
  'py-0.5 text-center text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase';

const DAY =
  'relative flex h-11 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors duration-(--duration-instant) ease-standard focus-visible:z-10 sm:h-8.5';

const DOT = 'absolute bottom-[4.5px] left-1/2 -translate-x-1/2 rounded-full bg-accent';

function moveOf(event: KeyboardEvent): DayMove | undefined {
  return (event.shiftKey ? SHIFT_MOVES[event.key] : undefined) ?? MOVES[event.key];
}

function labelOf(day: string, look: DayLook): string {
  const date = DAY_LABEL.format(new Date(`${day}T00:00:00Z`));
  return look.marks > 0 ? `${date}, ${COPY.hasEvents}` : date;
}

function toneOf(cell: MonthCell, look: DayLook): string {
  if (look.selected) return 'bg-accent font-semibold text-surface';
  if (look.disabled) return 'cursor-not-allowed bg-surface-3 text-ink-3/60';
  return cn(
    'cursor-pointer hover:bg-surface-3',
    cell.outside ? 'text-ink-3' : 'text-ink',
    look.today && 'font-semibold inset-ring-[1.5px] inset-ring-accent',
  );
}

type DayCellProps = Readonly<{
  cell: MonthCell;
  look: DayLook;
  focusTarget: RefCallback<HTMLButtonElement> | undefined;
  onPick: (day: string) => void;
}>;

function DayCell({ cell, look, focusTarget, onPick }: DayCellProps) {
  const dense = look.marks > DENSE_AFTER;
  return (
    <button
      ref={focusTarget}
      type="button"
      role="gridcell"
      tabIndex={focusTarget ? 0 : -1}
      aria-label={labelOf(cell.day, look)}
      aria-selected={look.selected}
      aria-current={look.today ? 'date' : undefined}
      aria-disabled={look.disabled || undefined}
      onClick={() => {
        onPick(cell.day);
      }}
      className={cn(DAY, toneOf(cell, look))}
    >
      {cell.date}
      {look.marks > 0 && !look.selected && (
        <span
          aria-hidden
          data-dot={dense ? 'dense' : 'single'}
          className={cn(DOT, dense ? 'size-1.5' : 'size-1')}
        />
      )}
    </button>
  );
}

function weeksOf(cells: readonly MonthCell[]) {
  return cells
    .filter((_, index) => index % WEEK === 0)
    .map((first, row) => ({ first: first.day, cells: cells.slice(row * WEEK, (row + 1) * WEEK) }));
}

export function CalendarDayGrid({ value, days, focus, actions }: CalendarDayGridProps) {
  const month = monthOf(focus.day);
  const lookOf = (day: string): DayLook => ({
    selected: day === value,
    today: day === days.today,
    disabled: isOutsideBounds(day, days),
    marks: days.marked?.[day] ?? 0,
  });
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = moveOf(event);
    if (move === undefined) return;
    event.preventDefault();
    actions.onMove(move(focus.day));
  };
  return (
    <div
      role="grid"
      aria-label={`${COPY.months[month.month] ?? ''} ${String(month.year)}`}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-1.5"
    >
      <div role="row" className="grid grid-cols-7 gap-0.5">
        {COPY.weekdays.map((weekday) => (
          <span key={weekday} role="columnheader" className={WEEKDAY}>
            {weekday}
          </span>
        ))}
      </div>
      <div role="rowgroup" className="flex flex-col gap-0.5">
        {weeksOf(monthGrid(month)).map((week) => (
          <div key={week.first} role="row" className="grid grid-cols-7 gap-0.5">
            {week.cells.map((cell) => (
              <DayCell
                key={cell.day}
                cell={cell}
                look={lookOf(cell.day)}
                focusTarget={cell.day === focus.day ? focus.target : undefined}
                onPick={actions.onPick}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
