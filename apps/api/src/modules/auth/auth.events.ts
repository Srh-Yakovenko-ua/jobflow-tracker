import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const AUTH_EVENTS = { userRegistered: 'user.registered' } as const;

export const userRegisteredPayloadSchema = z.object({ userId: z.uuid() });

export type UserRegisteredPayload = z.infer<typeof userRegisteredPayloadSchema>;

export function userRegisteredEvent(payload: UserRegisteredPayload): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'user',
    aggregateId: payload.userId,
    eventType: AUTH_EVENTS.userRegistered,
    payload,
  };
}
