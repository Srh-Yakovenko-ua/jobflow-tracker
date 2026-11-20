import type { ApplicationResponse } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { reminderKeys } from '@/entities/reminder';
import { scheduledEventKeys } from '@/entities/scheduled-event';
import { userKeys } from '@/entities/user';

export type FollowupInvalidation = Readonly<{
  queryClient: QueryClient;
  applicationId: ApplicationResponse['id'];
}>;

export async function invalidateFollowup({
  queryClient,
  applicationId,
}: FollowupInvalidation): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: applicationKeys.ai(applicationId, 'followup') }),
    queryClient.invalidateQueries({ queryKey: timelineKeys.detail(applicationId) }),
    queryClient.invalidateQueries({ queryKey: scheduledEventKeys.calendars() }),
    queryClient.invalidateQueries({ queryKey: userKeys.rhythm() }),
    queryClient.invalidateQueries({ queryKey: reminderKeys.all }),
  ]);
}
