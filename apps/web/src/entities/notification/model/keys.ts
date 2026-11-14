export type NotificationFilter = 'all' | 'unread';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filter: NotificationFilter = 'all') => [...notificationKeys.all, 'list', filter] as const,
  latest: () => [...notificationKeys.all, 'latest'] as const,
};
