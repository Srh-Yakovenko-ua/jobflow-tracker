import { rejectionReasonCodeSchema, stageSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const APPLICATION_EVENTS = {
  created: 'application.created',
  updated: 'application.updated',
  stageChanged: 'application.stage_changed',
} as const;

export const applicationCreatedPayloadSchema = z.object({
  userId: z.uuid(),
  applicationId: z.uuid(),
});

export const applicationUpdatedPayloadSchema = applicationCreatedPayloadSchema.extend({
  fields: z.array(z.string().min(1)).min(1),
});

export const applicationStageChangedPayloadSchema = applicationCreatedPayloadSchema.extend({
  fromStage: stageSchema,
  toStage: stageSchema,
  reasonCode: rejectionReasonCodeSchema.nullable(),
  compensatesEventId: z.uuid().nullable(),
});

export type ApplicationCreatedPayload = z.infer<typeof applicationCreatedPayloadSchema>;

export type ApplicationUpdatedPayload = z.infer<typeof applicationUpdatedPayloadSchema>;

export type ApplicationStageChangedPayload = z.infer<typeof applicationStageChangedPayloadSchema>;

export type ApplicationEvent =
  | ({ eventType: typeof APPLICATION_EVENTS.created } & Omit<ApplicationCreatedPayload, 'userId'>)
  | ({ eventType: typeof APPLICATION_EVENTS.updated } & Omit<ApplicationUpdatedPayload, 'userId'>)
  | ({ eventType: typeof APPLICATION_EVENTS.stageChanged } & Omit<
      ApplicationStageChangedPayload,
      'userId'
    >);

export function applicationEvent(
  userId: string,
  { eventType, ...change }: ApplicationEvent,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'application',
    aggregateId: change.applicationId,
    eventType,
    payload: { userId, ...change },
  };
}
