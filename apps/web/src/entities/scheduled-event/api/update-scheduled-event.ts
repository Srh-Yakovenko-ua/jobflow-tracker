import {
  type ScheduledEventUpdateResponse,
  scheduledEventUpdateResponseSchema,
  type UpdateScheduledEventInput,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

import type { ScheduledEventRef } from './scheduled-event-ics';

export type UpdateScheduledEventRequest = ScheduledEventRef &
  Readonly<{ body: UpdateScheduledEventInput }>;

export function updateScheduledEvent({
  applicationId,
  eventId,
  body,
}: UpdateScheduledEventRequest): Promise<ScheduledEventUpdateResponse> {
  return apiClient.request({
    path: `/applications/${applicationId}/scheduled-events/${eventId}`,
    method: 'PATCH',
    body,
    schema: scheduledEventUpdateResponseSchema,
  });
}
