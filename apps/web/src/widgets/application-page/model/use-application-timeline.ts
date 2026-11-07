import { type ApplicationResponse, DEFAULT_SILENCE_DAYS } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { timelineQueryOptions } from '@/entities/application';
import { notesQueryOptions } from '@/entities/note';
import { meQueryOptions, useUserTimeZone } from '@/entities/user';

import { timelineRowsOf } from '../lib/timeline-rows';
import { waitingRowOf } from '../lib/waiting-row';
import { sectionLoadOf } from './section-load';

function useSilenceDays(): number {
  const { data = DEFAULT_SILENCE_DAYS } = useQuery({
    ...meQueryOptions(),
    select: (me) => me.settings.silenceDays,
  });
  return data;
}

export function useApplicationTimeline(application: ApplicationResponse) {
  const timeline = useQuery(timelineQueryOptions(application.id));
  const notes = useQuery(notesQueryOptions(application.id));
  const silenceDays = useSilenceDays();
  const timeZone = useUserTimeZone();
  const [mountedAt] = useState(Date.now);
  const items = timeline.data?.items ?? [];
  const load = sectionLoadOf(timeline);
  return {
    rows: timelineRowsOf({ items, application, notes: notes.data?.items ?? [] }),
    waiting: waitingRowOf({ application, silenceDays, timeZone }),
    count: items.length,
    now: new Date(Math.max(timeline.dataUpdatedAt, mountedAt)),
    timeZone,
    load,
  };
}

export type ApplicationTimelineState = ReturnType<typeof useApplicationTimeline>;
