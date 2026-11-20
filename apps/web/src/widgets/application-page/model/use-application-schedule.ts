import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { eventAgendaOf, scheduledEventsQueryOptions } from '@/entities/scheduled-event';
import { useUserTimeZone } from '@/entities/user';
import { sectionLoadOf } from '@/shared/lib/section-load';
import { useQueryNow } from '@/shared/lib/use-query-now';

export function useApplicationSchedule(application: ApplicationResponse) {
  const list = useQuery(scheduledEventsQueryOptions(application.id));
  const timeZone = useUserTimeZone();
  const now = useQueryNow(list);
  return {
    agenda: eventAgendaOf({ events: list.data?.items ?? [], now }),
    context: { now, timeZone },
    load: sectionLoadOf(list),
  };
}
