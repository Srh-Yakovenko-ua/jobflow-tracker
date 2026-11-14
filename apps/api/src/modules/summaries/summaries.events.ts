import { yearMonthSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const SUMMARY_EVENTS = { requested: 'summary.requested' } as const;

export const summaryRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  aiJobId: z.uuid(),
  searchId: z.uuid(),
  month: yearMonthSchema,
  requestId: z.string().min(1).optional(),
  fresh: z.literal(true).optional(),
});

export type SummaryRequestedPayload = z.infer<typeof summaryRequestedPayloadSchema>;

export type SummaryRequested = Omit<SummaryRequestedPayload, 'userId'>;

export function summaryRequestedEvent(
  userId: string,
  requested: SummaryRequested,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'user',
    aggregateId: userId,
    eventType: SUMMARY_EVENTS.requested,
    payload: { userId, ...requested },
  };
}
