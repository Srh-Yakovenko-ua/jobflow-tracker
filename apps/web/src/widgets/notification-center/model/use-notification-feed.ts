import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  notificationDaysOf,
  notificationFeedInfiniteOptions,
  type NotificationFilter,
} from '@/entities/notification';
import { useUserTimeZone } from '@/entities/user';

export function useNotificationFeed() {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [now] = useState(() => new Date());
  const timeZone = useUserTimeZone();
  const query = useInfiniteQuery(notificationFeedInfiniteOptions(filter));
  const notifications = query.data?.pages.flatMap((page) => page.items);
  const days = notifications && notificationDaysOf({ notifications, zone: { now, timeZone } });
  return { filter: { value: filter, set: setFilter }, query, days, timeZone };
}

export type NotificationFeed = ReturnType<typeof useNotificationFeed>;
