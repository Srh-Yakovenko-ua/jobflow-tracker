import { notificationTypeSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const NOTIFICATION_EVENTS = { created: 'notification.created' } as const;

export const notificationCreatedPayloadSchema = z.object({
  userId: z.uuid(),
  notificationId: z.uuid(),
  type: notificationTypeSchema,
});

export type NotificationCreatedPayload = z.infer<typeof notificationCreatedPayloadSchema>;

export type CreatedNotification = Omit<NotificationCreatedPayload, 'userId'>;

export function notificationCreatedEvent(
  userId: string,
  { notificationId, type }: CreatedNotification,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'notification',
    aggregateId: notificationId,
    eventType: NOTIFICATION_EVENTS.created,
    payload: { userId, notificationId, type },
  };
}
