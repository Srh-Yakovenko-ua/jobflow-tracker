import { APPLICATION_CARD_STACK_LIMIT, type ApplicationCard } from '@jobflow/shared';

import type { CardRow } from './application-list.repository.js';
import { withApplicationTiming } from './application-timing.js';

export type CardContext = { now: Date; silenceDays: number };

export function toApplicationCard(
  row: CardRow,
  { now, silenceDays }: CardContext,
): ApplicationCard {
  const { scheduledEvents, aiJobs, stack, appliedAt, lastEventAt, ...columns } =
    withApplicationTiming({ row, silenceDays, now });
  const [nextEvent] = scheduledEvents;
  return {
    ...columns,
    appliedAt: appliedAt?.toISOString() ?? null,
    lastEventAt: lastEventAt.toISOString(),
    stack: stack.slice(0, APPLICATION_CARD_STACK_LIMIT),
    stackCount: stack.length,
    nextScheduledEvent: nextEvent
      ? { kind: nextEvent.kind, startsAt: nextEvent.startsAt.toISOString() }
      : null,
    aiStatus: aiJobs[0]?.status ?? null,
  };
}
