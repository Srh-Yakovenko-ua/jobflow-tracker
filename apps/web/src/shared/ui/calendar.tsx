'use client';

import { uk } from '@/shared/i18n';
import { formatDay } from '@/shared/lib/calendar-month';
import { cn } from '@/shared/lib/cn';

import { type CalendarChoice, CalendarChoiceGrid } from './calendar-choice-grid';
import { CalendarDayGrid, type CalendarDays } from './calendar-day-grid';
import { CALENDAR_CONTROL, CalendarHeader, CalendarStepper } from './calendar-header';
import { type CalendarView, useCalendarView } from './use-calendar-view';

export type { CalendarDays } from './calendar-day-grid';

export type CalendarSelection = Readonly<{
  value: string | null;
  onSelect: (day: string) => void;
}>;

export type CalendarDone = Readonly<{ onDone: () => void }>;

export type CalendarProps = Readonly<{
  selection: CalendarSelection;
  days: CalendarDays;
  done?: CalendarDone;
}>;

const COPY = uk.calendar;

const YEARS = { shown: 12, decadeEnd: 9 } as const;

const TODAY = cn(
  CALENDAR_CONTROL,
  'h-7.5 gap-1.75 px-2.5 text-[12.5px] font-semibold text-link hover:bg-accent-tint',
);

const DONE = cn(
  CALENDAR_CONTROL,
  'h-7.5 bg-accent px-3.25 text-label text-surface shadow-accent hover:bg-accent-press dark:hover:text-paper',
);

const MONTH_CHOICES: readonly CalendarChoice[] = COPY.monthsShort.map((label, index) => ({
  value: index,
  label,
  name: COPY.months[index],
}));

function yearChoicesOf(decade: number): CalendarChoice[] {
  return Array.from({ length: YEARS.shown }, (_, index) => {
    const year = decade - 1 + index;
    const muted = year < decade || year > decade + YEARS.decadeEnd;
    return { value: year, label: String(year), muted };
  });
}

function YearPanel({ view }: Readonly<{ view: CalendarView }>) {
  const { decade } = view.state;
  return (
    <div className="flex flex-col gap-2">
      <CalendarStepper
        labels={{ previous: COPY.previousDecade, next: COPY.nextDecade }}
        onStep={view.shiftDecade}
        look="decade"
      >
        <span className="text-[12.5px] font-semibold text-ink-2 tabular-nums">
          {COPY.decade(decade)}
        </span>
      </CalendarStepper>
      <CalendarChoiceGrid
        label={COPY.yearPanel}
        choices={yearChoicesOf(decade)}
        pick={{ current: view.month.year, onPick: view.pickYear }}
        focusTarget={view.focusTarget}
      />
    </div>
  );
}

type PanelBodyProps = Readonly<{ view: CalendarView; value: string | null; days: CalendarDays }>;

function PanelBody({ view, value, days }: PanelBodyProps) {
  if (view.state.panel === 'years') return <YearPanel view={view} />;
  if (view.state.panel === 'months') {
    return (
      <CalendarChoiceGrid
        label={COPY.monthPanel}
        choices={MONTH_CHOICES}
        pick={{ current: view.month.month, onPick: view.pickMonth }}
        focusTarget={view.focusTarget}
      />
    );
  }
  return (
    <CalendarDayGrid
      value={value}
      days={days}
      focus={{ day: view.state.focused, target: view.focusTarget }}
      actions={{ onPick: view.pickDay, onMove: view.moveFocus }}
    />
  );
}

type CalendarFooterProps = Readonly<{
  view: CalendarView;
  days: CalendarDays;
  done: CalendarDone | undefined;
}>;

function CalendarFooter({ view, days, done }: CalendarFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {days.marked && (
        <span className="caption flex items-center gap-2 text-ink-2">
          <span aria-hidden className="size-1.25 rounded-full bg-accent" />
          {COPY.marked}
        </span>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <button type="button" onClick={view.pickToday} className={TODAY}>
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          {COPY.today}
        </button>
        {done && (
          <button type="button" onClick={done.onDone} className={DONE}>
            {COPY.done}
          </button>
        )}
      </span>
    </div>
  );
}

export function Calendar({ selection, days, done }: CalendarProps) {
  const { value, onSelect } = selection;
  const view = useCalendarView({ value, onSelect, days });
  return (
    <div className="flex flex-col gap-3 font-ui text-ink">
      <CalendarHeader view={view} />
      <div key={view.state.panel} className="motion-safe:animate-cal-in">
        <PanelBody view={view} value={value} days={days} />
      </div>
      <div aria-hidden className="h-px bg-line-soft" />
      <CalendarFooter view={view} days={days} done={done} />
      <span className="caption text-ink-3">
        {COPY.selected}{' '}
        <span className="font-semibold text-ink tabular-nums">
          {value === null ? COPY.none : formatDay(value)}
        </span>
      </span>
    </div>
  );
}
