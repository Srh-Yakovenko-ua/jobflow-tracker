import type { Application } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { scheduledEventKeys } from '@/entities/scheduled-event';

export type ScheduleInvalidation = Readonly<{
  queryClient: QueryClient;
  applicationId: Application['id'];
}>;

export async function invalidateAfterSchedule({
  queryClient,
  applicationId,
}: ScheduleInvalidation): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: scheduledEventKeys.list(applicationId) }),
    queryClient.invalidateQueries({ queryKey: scheduledEventKeys.calendars() }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) }),
    queryClient.invalidateQueries({ queryKey: applicationKeys.boards() }),
    queryClient.invalidateQueries({ queryKey: applicationKeys.lists() }),
  ]);
}
