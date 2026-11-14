import {
  type MarkNotificationsReadInput,
  markNotificationsReadResponseSchema,
  type NotificationListQuery,
  notificationListResponseSchema,
} from '@jobflow/shared';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { apiClient, withSearchParams } from '@/shared/api';

import { type NotificationFilter, notificationKeys } from '../model/keys';

const NOTIFICATION_PAGES = { latest: 20, feed: 50 } as const;

type NotificationPageQuery = Readonly<{
  limit: NotificationListQuery['limit'];
  unread?: NotificationListQuery['unread'] | undefined;
  cursor?: NotificationListQuery['cursor'] | undefined;
}>;

type NotificationPageRequest = Readonly<{ query: NotificationPageQuery; signal: AbortSignal }>;

function fetchNotificationPage({ query, signal }: NotificationPageRequest) {
  return apiClient.request({
    path: withSearchParams('/notifications', query),
    schema: notificationListResponseSchema,
    signal,
  });
}

export function notificationListQueryOptions() {
  return queryOptions({
    queryKey: notificationKeys.latest(),
    queryFn: ({ signal }) =>
      fetchNotificationPage({ query: { limit: NOTIFICATION_PAGES.latest }, signal }),
  });
}

export function notificationFeedInfiniteOptions(filter: NotificationFilter) {
  const unread = filter === 'unread' ? true : undefined;
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(filter),
    queryFn: ({ signal, pageParam }) =>
      fetchNotificationPage({
        query: { limit: NOTIFICATION_PAGES.feed, unread, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function markNotificationsRead(input: MarkNotificationsReadInput) {
  return apiClient.request({
    path: '/notifications/read',
    method: 'POST',
    body: input,
    schema: markNotificationsReadResponseSchema,
  });
}
