import type { Application, ScheduledEvent } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export type ScheduledEventRef = Readonly<{
  applicationId: Application['id'];
  eventId: ScheduledEvent['id'];
}>;

export function scheduledEventIcs({ applicationId, eventId }: ScheduledEventRef): Promise<string> {
  return apiClient.request({
    path: `/applications/${applicationId}/scheduled-events/${eventId}/ics`,
    schema: z.string(),
    response: 'text',
  });
}
