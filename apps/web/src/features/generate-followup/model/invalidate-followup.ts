import type { ApplicationResponse } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { scheduledEventKeys } from '@/entities/scheduled-event';

export type FollowupInvalidation = Readonly<{
  queryClient: QueryClient;
  applicationId: ApplicationResponse['id'];
}>;

export async function invalidateFollowup({
  queryClient,
  applicationId,
}: FollowupInvalidation): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: applicationKeys.followup(applicationId) }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) }),
    queryClient.invalidateQueries({ queryKey: scheduledEventKeys.calendars() }),
  ]);
}
