import type { ScheduledEventKind } from '@jobflow/shared';
import { CalendarClock, type LucideIcon, PhoneCall } from 'lucide-react';

import { formatNextEvent, type ScheduledEventSlot } from '../lib/next-event';
import type { ApplicationCardContext } from '../model/card-context';

export type NextEventChipProps = Readonly<{
  event: ScheduledEventSlot;
  context: ApplicationCardContext;
}>;

const EVENT_ICON: Record<ScheduledEventKind, LucideIcon> = {
  screening_call: PhoneCall,
  tech_interview: CalendarClock,
  final_interview: CalendarClock,
  offer_call: PhoneCall,
  other: CalendarClock,
};

export function NextEventChip({ event, context }: NextEventChipProps) {
  const Icon = EVENT_ICON[event.kind];
  return (
    <span className="flex items-center gap-2 rounded-sm bg-accent-tint px-2.25 py-1.5 text-[12px] font-medium text-accent-ink tabular-nums">
      <Icon aria-hidden size={14} className="flex-none" />
      {formatNextEvent({ event, now: context.now, timeZone: context.timeZone })}
    </span>
  );
}
