import type { CalendarItem } from '@jobflow/shared';

type ScheduledEventProps = Extract<CalendarItem['extendedProps'], { type: 'scheduled_event' }>;

export type UpcomingInterview = CalendarItem & Readonly<{ extendedProps: ScheduledEventProps }>;

export type UpcomingInterviewsInput = Readonly<{ items: readonly CalendarItem[]; now: Date }>;

function isPlannedEvent(item: CalendarItem): item is UpcomingInterview {
  return item.extendedProps.type === 'scheduled_event' && item.extendedProps.status === 'planned';
}

export function upcomingInterviewsOf({ items, now }: UpcomingInterviewsInput): UpcomingInterview[] {
  return items
    .filter(isPlannedEvent)
    .filter((item) => Date.parse(item.start) >= now.getTime())
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}
