import type { ScheduledEvent } from '@jobflow/shared';

export type EventAgendaInput = Readonly<{ events: readonly ScheduledEvent[]; now: Date }>;

export type EventAgenda = Readonly<{
  upcoming: ScheduledEvent | undefined;
  awaitingOutcome: ScheduledEvent | undefined;
}>;

function byStart(first: ScheduledEvent, second: ScheduledEvent): number {
  return (
    Date.parse(first.startsAt) - Date.parse(second.startsAt) || first.id.localeCompare(second.id)
  );
}

export function eventAgendaOf({ events, now }: EventAgendaInput): EventAgenda {
  const planned = events.filter((event) => event.status === 'planned').sort(byStart);
  const hasStarted = (event: ScheduledEvent) => Date.parse(event.startsAt) < now.getTime();
  return {
    upcoming: planned.find((event) => !hasStarted(event)),
    awaitingOutcome: planned.find(hasStarted),
  };
}
