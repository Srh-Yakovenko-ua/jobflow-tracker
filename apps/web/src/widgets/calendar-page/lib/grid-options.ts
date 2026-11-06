import type { CalendarOptions } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import interactionPlugin from '@fullcalendar/react/interaction';
import listPlugin from '@fullcalendar/react/list';
import ukLocale from '@fullcalendar/react/locales/uk';
import classicTheme from '@fullcalendar/react/themes/classic';
import timeGridPlugin from '@fullcalendar/react/timegrid';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

const COPY = uk.calendarPage;

export const GRID_OPTIONS = {
  plugins: [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  locale: ukLocale,
  headerToolbar: false,
  firstDay: 1,
  height: 'auto',
  dayMaxEvents: 3,
  eventDisplay: 'block',
  nowIndicator: true,
  slotMinTime: '08:00',
  slotMaxTime: '21:00',
  allDayText: COPY.allDay,
  timedText: COPY.timed,
  moreLinkText: COPY.more,
  noEventsClass: 'hidden',
  noEventsContent: () => null,
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventInteractive: true,
  className: 'font-ui text-[12.5px] text-ink',
  dayHeaderInnerClass:
    'px-1.5 py-2 text-[10.5px] font-semibold tracking-[.06em] text-ink-3 uppercase',
  dayCellTopInnerClass: 'px-2 py-1.5 text-[12.5px] font-medium tabular-nums',
  blockEventClass: 'mx-1 mt-px mb-0.5 rounded-[7px] border-0 hover:brightness-97',
  blockEventInnerClass: 'px-1.75 py-0.5 text-[11.5px] font-medium',
  columnEventClass: 'rounded-lg border-0',
  columnEventInnerClass: 'px-1.5 py-0.75 text-[11.5px] font-medium',
  listItemEventClass: cn('text-[12.5px] hover:bg-surface-2', TOUCH_HEIGHT),
  listDayHeaderInnerClass: 'text-[12px] font-semibold',
  moreLinkClass: 'text-[11px] font-semibold text-link',
  rowMoreLinkClass: 'px-1.5',
  popoverClass: 'overflow-hidden rounded-lg border-0 shadow-e3',
  slotHeaderInnerClass: 'text-[11px] text-ink-3 tabular-nums',
  views: {
    dayGridMonth: { dayCellClass: 'min-h-19.5' },
    timeGrid: {
      slotEventOverlap: false,
      eventMaxStack: 1,
      displayEventEnd: false,
      dayLaneInnerClass: 'has-[[aria-haspopup=dialog]]:me-6.5',
      columnMoreLinkClass: 'absolute inset-y-0 start-0.5 w-6 items-center',
    },
  },
} satisfies CalendarOptions;
