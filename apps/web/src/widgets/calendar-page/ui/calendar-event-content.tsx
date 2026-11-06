import type { EventApi } from '@fullcalendar/react';
import type { ScheduledEventKind } from '@jobflow/shared';
import { AlarmClock, type LucideIcon } from 'lucide-react';

import { SCHEDULED_EVENT_ICON } from '@/entities/application';

import { eventPropsOf } from '../lib/event-props';

type ShownKind = ScheduledEventKind | 'followup';

const ICON_OF: Record<ShownKind, LucideIcon> = { ...SCHEDULED_EVENT_ICON, followup: AlarmClock };

export type ShownEvent = Readonly<{
  event: Pick<EventApi, 'title' | 'extendedProps'>;
  timeText: string;
}>;

export type CalendarEventContentProps = Readonly<{ shown: ShownEvent }>;

function kindOf(extendedProps: unknown): ShownKind {
  const props = eventPropsOf(extendedProps);
  return props?.type === 'scheduled_event' ? props.eventKind : 'followup';
}

export function CalendarEventContent({ shown }: CalendarEventContentProps) {
  const Icon = ICON_OF[kindOf(shown.event.extendedProps)];
  return (
    <span className="@container flex w-full min-w-0 items-center gap-1.5 overflow-hidden">
      <Icon aria-hidden size={16} strokeWidth={1.9} className="flex-none @max-[3.5rem]:hidden" />
      {shown.timeText && (
        <span className="flex-none font-semibold tabular-nums">{shown.timeText}</span>
      )}
      <span className="min-w-0 truncate">{shown.event.title}</span>
    </span>
  );
}
