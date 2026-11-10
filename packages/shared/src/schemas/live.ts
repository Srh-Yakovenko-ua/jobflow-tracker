import { z } from 'zod';

import { jobUpdatedSchema } from './job.js';

export const LIVE_EVENTS = {
  jobUpdated: 'job.updated',
  applicationUpdated: 'application.updated',
  notificationCreated: 'notification.created',
} as const;

export const LIVE_LIMITS = {
  ticketTtlSeconds: 30,
  heartbeatSeconds: 25,
  pollFallbackMs: 2000,
  streamMaxSeconds: 900,
} as const;

export const liveApplicationUpdatedSchema = z.object({
  applicationId: z.uuid(),
  fields: z.array(z.string()),
});

export const liveNotificationCreatedSchema = z.object({ notificationId: z.uuid() });

const liveEventBaseSchema = z.object({ id: z.uuid() });

export const liveEventSchema = z.discriminatedUnion('type', [
  liveEventBaseSchema.extend({
    type: z.literal(LIVE_EVENTS.jobUpdated),
    data: jobUpdatedSchema,
  }),
  liveEventBaseSchema.extend({
    type: z.literal(LIVE_EVENTS.applicationUpdated),
    data: liveApplicationUpdatedSchema,
  }),
  liveEventBaseSchema.extend({
    type: z.literal(LIVE_EVENTS.notificationCreated),
    data: liveNotificationCreatedSchema,
  }),
]);

export const liveTicketSchema = z.object({ ticket: z.string().min(1), expiresInSeconds: z.int() });

export const liveStreamQuerySchema = z.object({ ticket: z.string().max(128).default('') });

export type LiveApplicationUpdated = z.infer<typeof liveApplicationUpdatedSchema>;
export type LiveNotificationCreated = z.infer<typeof liveNotificationCreatedSchema>;
export type LiveEvent = z.infer<typeof liveEventSchema>;
export type LiveTicket = z.infer<typeof liveTicketSchema>;
export type LiveStreamQuery = z.infer<typeof liveStreamQuerySchema>;
