import type { MarkNotificationsReadResponse } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { notificationKeys } from '@/entities/notification';
import { meQueryOptions } from '@/entities/user';

export const UNREAD_CHANNEL = 'jobflow:notifications';

const ME_KEY = meQueryOptions().queryKey;

export function unreadOf(queryClient: QueryClient): number | undefined {
  return queryClient.getQueryData(ME_KEY)?.unreadNotifications;
}

export function applyUnread(queryClient: QueryClient, { unread }: MarkNotificationsReadResponse) {
  queryClient.setQueryData(ME_KEY, (me) =>
    me === undefined ? me : { ...me, unreadNotifications: unread },
  );
  return queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}
