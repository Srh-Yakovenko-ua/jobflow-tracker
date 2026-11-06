import { formatNextEvent, type ScheduledEventSlot } from '../lib/next-event';
import type { ApplicationCardContext } from '../model/card-context';
import { SCHEDULED_EVENT_ICON } from './event-icon';

export type NextEventChipProps = Readonly<{
  event: ScheduledEventSlot;
  context: ApplicationCardContext;
}>;

export function NextEventChip({ event, context }: NextEventChipProps) {
  const Icon = SCHEDULED_EVENT_ICON[event.kind];
  return (
    <span className="flex items-center gap-2 rounded-sm bg-accent-tint px-2.25 py-1.5 text-[12px] font-medium text-accent-ink tabular-nums">
      <Icon aria-hidden size={14} className="flex-none" />
      {formatNextEvent({ event, now: context.now, timeZone: context.timeZone })}
    </span>
  );
}
