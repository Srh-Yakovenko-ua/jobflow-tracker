import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { traceCarrier } from '../../tracing/trace-context.js';

export const SEARCH_EVENTS = { finished: 'search.finished' } as const;

export const searchFinishedPayloadSchema = z.object({
  userId: z.uuid(),
  searchId: z.uuid(),
});

export function searchFinishedEvent(
  userId: string,
  searchId: string,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'search',
    aggregateId: searchId,
    eventType: SEARCH_EVENTS.finished,
    payload: { userId, searchId },
    ...traceCarrier(),
  };
}
