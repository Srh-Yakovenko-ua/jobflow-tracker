'use client';

import { useRef, useState } from 'react';

import {
  addMonths,
  type CalendarMonth,
  clampDay,
  inMonth,
  isOutsideBounds,
  monthOf,
} from '@/shared/lib/calendar-month';

import type { CalendarDays } from './calendar-day-grid';

export type CalendarPanel = 'days' | 'months' | 'years';

export type CalendarViewInput = Readonly<{
  value: string | null;
  onSelect: (day: string) => void;
  days: CalendarDays;
}>;

type CalendarState = Readonly<{ focused: string; panel: CalendarPanel; decade: number }>;

const DECADE = 10;

function decadeOf(day: string): number {
  return Math.floor(monthOf(day).year / DECADE) * DECADE;
}

function seedOf({ value, days }: CalendarViewInput): CalendarState {
  const focused = clampDay(value ?? days.today, days);
  return { focused, panel: 'days', decade: decadeOf(focused) };
}

function useFocusRequest() {
  const pendingRef = useRef(false);
  return {
    request: () => {
      pendingRef.current = true;
    },
    target: (node: HTMLElement | null) => {
      if (node === null || !pendingRef.current) return;
      pendingRef.current = false;
      node.focus();
    },
  };
}

type StateUpdate = Readonly<{
  state: CalendarState;
  setState: (next: CalendarState) => void;
}>;

function headerActionsOf({ state, setState }: StateUpdate) {
  return {
    shiftMonth: (count: number) => {
      setState({ ...state, focused: addMonths(state.focused, count) });
    },
    shiftDecade: (count: number) => {
      setState({ ...state, decade: state.decade + count * DECADE });
    },
    togglePanel: (panel: CalendarPanel) => {
      const next = state.panel === panel ? 'days' : panel;
      setState({ ...state, panel: next, decade: decadeOf(state.focused) });
    },
  };
}

export function useCalendarView(input: CalendarViewInput) {
  const { onSelect, days } = input;
  const [state, setState] = useState(() => seedOf(input));
  const focus = useFocusRequest();
  const month: CalendarMonth = monthOf(state.focused);
  const focusDay = (day: string, panel: CalendarPanel = 'days') => {
    if (day !== state.focused || panel !== state.panel) focus.request();
    setState({ ...state, focused: day, panel });
  };
  const select = (day: string) => {
    if (!isOutsideBounds(day, days)) onSelect(day);
  };
  return {
    state,
    month,
    focusTarget: focus.target,
    ...headerActionsOf({ state, setState }),
    moveFocus: (day: string) => {
      focusDay(day);
    },
    pickDay: (day: string) => {
      focusDay(day);
      select(day);
    },
    pickMonth: (value: number) => {
      focusDay(inMonth(state.focused, { year: month.year, month: value }));
    },
    pickYear: (value: number) => {
      focusDay(inMonth(state.focused, { year: value, month: month.month }), 'months');
    },
    pickToday: () => {
      setState({ ...state, focused: days.today, panel: 'days' });
      select(days.today);
    },
  };
}

export type CalendarView = ReturnType<typeof useCalendarView>;
