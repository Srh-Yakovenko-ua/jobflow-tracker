import { rejectionReasonCodeSchema, stageSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import type { StageEventPlan } from './stage-transition.repository.js';

export const APPLICATION_EVENTS = {
  created: 'application.created',
  updated: 'application.updated',
  stageChanged: 'application.stage_changed',
  captureRequested: 'application.capture_requested',
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

export const applicationCaptureRequestedPayloadSchema = applicationCreatedPayloadSchema.extend({
  aiJobId: z.uuid(),
  requestId: z.string().min(1).optional(),
});

export type ApplicationCreatedPayload = z.infer<typeof applicationCreatedPayloadSchema>;

export type ApplicationUpdatedPayload = z.infer<typeof applicationUpdatedPayloadSchema>;

export type ApplicationStageChangedPayload = z.infer<typeof applicationStageChangedPayloadSchema>;

export type ApplicationCaptureRequestedPayload = z.infer<
  typeof applicationCaptureRequestedPayloadSchema
>;

export type ApplicationEvent =
  | ({ eventType: typeof APPLICATION_EVENTS.created } & Omit<ApplicationCreatedPayload, 'userId'>)
  | ({ eventType: typeof APPLICATION_EVENTS.updated } & Omit<ApplicationUpdatedPayload, 'userId'>)
  | ({ eventType: typeof APPLICATION_EVENTS.stageChanged } & Omit<
      ApplicationStageChangedPayload,
      'userId'
    >)
  | ({ eventType: typeof APPLICATION_EVENTS.captureRequested } & Omit<
      ApplicationCaptureRequestedPayload,
      'userId'
    >);

export type AppliedStageEvent = Pick<StageEventPlan, 'event'> & { id: string };

export function stageChanged({ id, event }: AppliedStageEvent): ApplicationEvent {
  const { fromStage, toStage, reasonCode, compensatesEventId } = event;
  return {
    eventType: APPLICATION_EVENTS.stageChanged,
    applicationId: id,
    fromStage,
    toStage,
    reasonCode,
    compensatesEventId,
  };
}

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
