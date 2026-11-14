import { markNotificationsReadResponseSchema } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { applyUnread, UNREAD_CHANNEL, unreadOf } from './unread-cache';

export function useUnreadSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(UNREAD_CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const parsed = markNotificationsReadResponseSchema.safeParse(event.data);
      if (!parsed.success || unreadOf(queryClient) === parsed.data.unread) return;
      void applyUnread(queryClient, parsed.data);
    };
    return () => {
      channel.close();
    };
  }, [queryClient]);
}
