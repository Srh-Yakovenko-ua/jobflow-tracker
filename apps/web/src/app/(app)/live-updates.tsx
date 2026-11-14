'use client';

import { LIVE_EVENTS, type LiveEvent } from '@jobflow/shared';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent } from 'react';

import { applicationKeys, jobKeys, timelineKeys } from '@/entities/application';
import { notificationKeys } from '@/entities/notification';
import { userKeys } from '@/entities/user';
import { isMovePending } from '@/features/move-application';
import { openLiveStream } from '@/shared/api';
import { announceNotification } from '@/widgets/notification-center';

const MISSED_WHILE_AWAY: readonly QueryKey[] = [
  applicationKeys.all,
  jobKeys.all,
  timelineKeys.all,
  userKeys.me(),
  notificationKeys.all,
];

function staleKeysOf(event: LiveEvent): readonly QueryKey[] {
  switch (event.type) {
    case LIVE_EVENTS.jobUpdated: {
      const { id, applicationId } = event.data;
      const detail = applicationId === null ? [] : [applicationKeys.detail(applicationId)];
      return [jobKeys.detail(id), applicationKeys.boards(), applicationKeys.lists(), ...detail];
    }
    case LIVE_EVENTS.applicationUpdated: {
      const { applicationId } = event.data;
      return [
        applicationKeys.detail(applicationId),
        applicationKeys.boards(),
        applicationKeys.lists(),
        timelineKeys.detail(applicationId),
      ];
    }
    case LIVE_EVENTS.notificationCreated:
      return [userKeys.me(), notificationKeys.all];
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled live event: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function LiveUpdates() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const open = useEffectEvent((href: string) => {
    router.push(href);
  });
  useEffect(() => {
    const refetch = (queryKeys: readonly QueryKey[]) => {
      const moving = isMovePending(queryClient);
      for (const queryKey of queryKeys) {
        const settlesWithMove = moving && queryKey[0] === applicationKeys.all[0];
        void queryClient.invalidateQueries({
          queryKey,
          refetchType: settlesWithMove ? 'none' : 'active',
        });
      }
    };
    return openLiveStream({
      onEvent: (event) => {
        refetch(staleKeysOf(event));
        if (event.type !== LIVE_EVENTS.notificationCreated) return;
        const { notificationId } = event.data;
        const navigate = (href: string) => {
          open(href);
        };
        void announceNotification({ queryClient, notificationId, navigate });
      },
      onReconnect: () => {
        refetch(MISSED_WHILE_AWAY);
      },
    });
  }, [queryClient]);
  return null;
}
