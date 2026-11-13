import { followupInputSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const FOLLOWUP_EVENTS = { requested: 'application.followup_requested' } as const;

export const followupRequestedPayloadSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid(),
  aiJobId: z.uuid(),
  requestId: z.string().min(1).optional(),
  input: followupInputSchema,
  fresh: z.literal(true).optional(),
});

export type FollowupRequestedPayload = z.infer<typeof followupRequestedPayloadSchema>;

export type FollowupRequested = Omit<FollowupRequestedPayload, 'userId'>;

export function followupRequestedEvent(
  userId: string,
  requested: FollowupRequested,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'application',
    aggregateId: requested.applicationId,
    eventType: FOLLOWUP_EVENTS.requested,
    payload: { userId, ...requested },
  };
}
