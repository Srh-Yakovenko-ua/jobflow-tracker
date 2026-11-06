import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { eventAgendaOf, scheduledEventsQueryOptions } from '@/entities/scheduled-event';
import { useUserTimeZone } from '@/entities/user';

import { sectionLoadOf } from './section-load';

export function useApplicationSchedule(application: ApplicationResponse) {
  const list = useQuery(scheduledEventsQueryOptions(application.id));
  const timeZone = useUserTimeZone();
  const [mountedAt] = useState(Date.now);
  const now = new Date(Math.max(list.dataUpdatedAt, mountedAt));
  return {
    agenda: eventAgendaOf({ events: list.data?.items ?? [], now }),
    context: { now, timeZone },
    load: sectionLoadOf(list),
  };
}
