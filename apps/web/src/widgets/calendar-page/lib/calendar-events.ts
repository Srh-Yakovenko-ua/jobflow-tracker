import type { EventInput } from '@fullcalendar/react';
import type { CalendarItem } from '@jobflow/shared';

import { EVENT_LOOK, type EventLook, FOLLOWUP_LOOK } from './event-look';

function lookOf({ extendedProps }: CalendarItem): EventLook {
  return extendedProps.type === 'followup' ? FOLLOWUP_LOOK : EVENT_LOOK[extendedProps.stage];
}

function isMovable({ extendedProps }: CalendarItem): boolean {
  return extendedProps.type === 'scheduled_event' && extendedProps.status === 'planned';
}

export function eventInputOf(item: CalendarItem): EventInput {
  const { id, title, start, end, allDay, extendedProps } = item;
  return {
    id,
    title,
    start,
    ...(end === null ? {} : { end }),
    allDay,
    startEditable: isMovable(item),
    durationEditable: false,
    ...lookOf(item),
    extendedProps,
  };
}
