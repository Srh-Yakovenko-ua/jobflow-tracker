import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { traceCarrier } from '../../tracing/trace-context.js';

export const RHYTHM_EVENTS = { weekClosed: 'rhythm.week_closed' } as const;

export const rhythmWeekClosedPayloadSchema = z.object({
  userId: z.uuid(),
  weekStart: z.iso.date(),
  requestId: z.string().min(1).optional(),
});

export type RhythmWeekClosedPayload = z.infer<typeof rhythmWeekClosedPayloadSchema>;

export type RhythmWeekClosed = Omit<RhythmWeekClosedPayload, 'userId'>;

export function rhythmWeekClosedEvent(
  userId: string,
  closed: RhythmWeekClosed,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'user',
    aggregateId: userId,
    eventType: RHYTHM_EVENTS.weekClosed,
    payload: { userId, ...closed },
    ...traceCarrier(),
  };
}
