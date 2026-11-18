'use client';

import './calendar-grid.css';

import FullCalendar, { type CalendarController } from '@fullcalendar/react';
import type { CalendarItem } from '@jobflow/shared';

import { eventInputOf } from '../lib/calendar-events';
import { type GridActions, gridHandlersOf } from '../lib/grid-handlers';
import { EVENT_MAX_STACK, GRID_OPTIONS } from '../lib/grid-options';
import type { CalendarView } from '../model/calendar-views';
import { CalendarEventContent } from './calendar-event-content';

export type CalendarGridData = Readonly<{
  controller: CalendarController;
  initialView: CalendarView;
  items: readonly CalendarItem[];
  timeZone: string;
  narrow: boolean;
}>;

export type CalendarGridProps = Readonly<{ calendar: CalendarGridData; actions: GridActions }>;

export function CalendarGrid({ calendar, actions }: CalendarGridProps) {
  return (
    <FullCalendar
      {...GRID_OPTIONS}
      {...gridHandlersOf(actions)}
      controller={calendar.controller}
      initialView={calendar.initialView}
      timeZone={calendar.timeZone}
      eventMaxStack={calendar.narrow ? EVENT_MAX_STACK.narrow : EVENT_MAX_STACK.wide}
      events={calendar.items.map(eventInputOf)}
      eventContent={(shown) => <CalendarEventContent shown={shown} />}
      moreLinkContent={(link) => <span aria-hidden>{link.text}</span>}
    />
  );
}
