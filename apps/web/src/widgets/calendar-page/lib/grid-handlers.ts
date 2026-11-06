import type { DatesSetInfo, EventApi } from '@fullcalendar/react';
import type { CalendarQuery } from '@jobflow/shared';

import type { RescheduleDrop } from '@/features/schedule-event';

import { rangeOf } from './calendar-range';
import { eventPropsOf } from './event-props';
import { type DroppedEvent, rescheduleOf } from './reschedule';

export type ShownPeriod = Readonly<{ range: CalendarQuery; title: string; current: boolean }>;

export type GridActions = Readonly<{
  onPeriod: (period: ShownPeriod) => void;
  onOpen: (applicationId: string) => void;
  onReschedule: (drop: RescheduleDrop) => void;
}>;

type ShownDates = Pick<DatesSetInfo, 'start' | 'end' | 'view'>;

type ClickedEvent = Readonly<{
  event: Pick<EventApi, 'extendedProps'>;
  jsEvent: Pick<Event, 'preventDefault'>;
}>;

type DroppedInfo = Readonly<{ event: DroppedEvent; revert: () => void }>;

export function gridHandlersOf({ onPeriod, onOpen, onReschedule }: GridActions) {
  return {
    datesSet: ({ start, end, view }: ShownDates) => {
      const now = Date.now();
      const current = start.getTime() <= now && now < end.getTime();
      onPeriod({ range: rangeOf({ start, end }), title: view.title, current });
    },
    eventClick: ({ event, jsEvent }: ClickedEvent) => {
      jsEvent.preventDefault();
      const props = eventPropsOf(event.extendedProps);
      if (props !== null) onOpen(props.applicationId);
    },
    eventDrop: ({ event, revert }: DroppedInfo) => {
      const drop = rescheduleOf(event);
      if (drop === null) {
        revert();
        return;
      }
      onReschedule({ ...drop, revert });
    },
  };
}
