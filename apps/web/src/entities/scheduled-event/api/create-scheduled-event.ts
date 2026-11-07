import {
  type Application,
  type CreateScheduledEventInput,
  type ScheduledEvent,
  scheduledEventSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type CreateScheduledEventRequest = Readonly<{
  applicationId: Application['id'];
  body: CreateScheduledEventInput;
  idempotencyKey: string;
}>;

export function createScheduledEvent({
  applicationId,
  body,
  idempotencyKey,
}: CreateScheduledEventRequest): Promise<ScheduledEvent> {
  return apiClient.request({
    path: `/applications/${applicationId}/scheduled-events`,
    method: 'POST',
    body,
    schema: scheduledEventSchema,
    idempotencyKey,
  });
}
