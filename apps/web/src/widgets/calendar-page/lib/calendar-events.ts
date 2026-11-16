import type { EventInput } from '@fullcalendar/react';
import type { CalendarItem } from '@jobflow/shared';

import { EVENT_LOOK, type EventLook, FOLLOWUP_LOOK } from './event-look';

type FixedLookType = Exclude<CalendarItem['extendedProps']['type'], 'scheduled_event'>;

const FIXED_LOOK: Record<FixedLookType, EventLook> = {
  followup: FOLLOWUP_LOOK,
  auto_ghost: EVENT_LOOK.ghosted,
};

function lookOf({ extendedProps }: CalendarItem): EventLook {
  return extendedProps.type === 'scheduled_event'
    ? EVENT_LOOK[extendedProps.stage]
    : FIXED_LOOK[extendedProps.type];
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
