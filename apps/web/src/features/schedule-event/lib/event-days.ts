import type { ScheduledEvent } from '@jobflow/shared';

import { dayKeyOf } from '@/shared/lib/zoned-time';

export type EventDaysInput = Readonly<{ events: readonly ScheduledEvent[]; timeZone: string }>;

export function eventDaysOf({ events, timeZone }: EventDaysInput): Record<string, number> {
  const days: Record<string, number> = {};
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const day = dayKeyOf(new Date(event.startsAt), timeZone);
    days[day] = (days[day] ?? 0) + 1;
  }
  return days;
}
