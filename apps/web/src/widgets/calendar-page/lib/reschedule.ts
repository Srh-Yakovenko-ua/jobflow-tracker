import type { EventApi } from '@fullcalendar/react';

import type { EventReschedule } from '@/features/schedule-event';

import { eventPropsOf } from './event-props';

export type DroppedEvent = Pick<EventApi, 'id' | 'start' | 'allDay' | 'extendedProps'>;

export function rescheduleOf({
  id,
  start,
  allDay,
  extendedProps,
}: DroppedEvent): EventReschedule | null {
  const props = eventPropsOf(extendedProps);
  if (props?.type !== 'scheduled_event' || start === null || allDay) return null;
  return { applicationId: props.applicationId, eventId: id, startsAt: start.toISOString() };
}
