'use client';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import type { CalendarView } from './use-calendar-view';

const COPY = uk.calendar;

export const CALENDAR_CONTROL =
  'touch-target flex flex-none items-center justify-center rounded-sm transition-colors duration-(--duration-instant) ease-standard';

const NAV = cn(
  CALENDAR_CONTROL,
  'w-8 bg-surface-2 text-ink-2 inset-ring inset-ring-line hover:bg-surface-3 active:bg-surface-3',
);

const TOGGLE = cn(
  CALENDAR_CONTROL,
  'h-7.5 gap-1.5 px-2.75 text-[13.5px] font-semibold tabular-nums',
);

const STEPPER_LOOK = {
  month: { row: 'gap-1.5', button: 'h-8', icon: 16 },
  decade: { row: 'justify-between gap-2', button: 'h-7.5', icon: 14 },
} as const;

export type CalendarStepperProps = Readonly<{
  labels: Readonly<{ previous: string; next: string }>;
  onStep: (count: number) => void;
  look: keyof typeof STEPPER_LOOK;
  children: ReactNode;
}>;

export function CalendarStepper({ labels, onStep, look, children }: CalendarStepperProps) {
  const { row, button, icon } = STEPPER_LOOK[look];
  return (
    <div className={cn('flex items-center', row)}>
      <button
        type="button"
        aria-label={labels.previous}
        onClick={() => {
          onStep(-1);
        }}
        className={cn(NAV, button)}
      >
        <ChevronLeft aria-hidden size={icon} />
      </button>
      {children}
      <button
        type="button"
        aria-label={labels.next}
        onClick={() => {
          onStep(1);
        }}
        className={cn(NAV, button)}
      >
        <ChevronRight aria-hidden size={icon} />
      </button>
    </div>
  );
}

type PanelToggleProps = Readonly<{ expanded: boolean; onToggle: () => void; children: ReactNode }>;

function PanelToggle({ expanded, onToggle, children }: PanelToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className={cn(
        TOGGLE,
        expanded
          ? 'bg-accent-tint text-accent-ink'
          : 'bg-surface-2 text-ink hover:bg-surface-3 active:bg-surface-3',
      )}
    >
      {children}
      <ChevronDown aria-hidden size={14} className="opacity-50" />
    </button>
  );
}

export function CalendarHeader({ view }: Readonly<{ view: CalendarView }>) {
  const { month, state } = view;
  return (
    <CalendarStepper
      labels={{ previous: COPY.previousMonth, next: COPY.nextMonth }}
      onStep={view.shiftMonth}
      look="month"
    >
      <PanelToggle
        expanded={state.panel === 'months'}
        onToggle={() => {
          view.togglePanel('months');
        }}
      >
        {COPY.months[month.month]}
      </PanelToggle>
      <PanelToggle
        expanded={state.panel === 'years'}
        onToggle={() => {
          view.togglePanel('years');
        }}
      >
        {String(month.year)}
      </PanelToggle>
      <span className="flex-1" />
    </CalendarStepper>
  );
}
