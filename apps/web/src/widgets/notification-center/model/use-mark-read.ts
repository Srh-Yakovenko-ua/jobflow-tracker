import type { MarkNotificationsReadResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markNotificationsRead } from '@/entities/notification';

import { applyUnread, UNREAD_CHANNEL } from './unread-cache';

function tellOtherTabs(response: MarkNotificationsReadResponse) {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(UNREAD_CHANNEL);
  channel.postMessage(response);
  channel.close();
}

export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: (response) => {
      tellOtherTabs(response);
      return applyUnread(queryClient, response);
    },
  });
}
