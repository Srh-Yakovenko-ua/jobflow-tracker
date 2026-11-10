'use client';

import { LIVE_EVENTS, type LiveEvent } from '@jobflow/shared';
import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { applicationKeys, jobKeys, timelineKeys } from '@/entities/application';
import { openLiveStream } from '@/shared/api';

const MISSED_WHILE_AWAY: readonly QueryKey[] = [applicationKeys.all, jobKeys.all, timelineKeys.all];

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
      return [];
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled live event: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function LiveUpdates() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refetch = (queryKeys: readonly QueryKey[]) => {
      for (const queryKey of queryKeys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    return openLiveStream({
      onEvent: (event) => {
        refetch(staleKeysOf(event));
      },
      onReconnect: () => {
        refetch(MISSED_WHILE_AWAY);
      },
    });
  }, [queryClient]);
  return null;
}
