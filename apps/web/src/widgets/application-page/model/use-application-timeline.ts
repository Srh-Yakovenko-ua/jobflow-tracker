import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { sectionLoadOf, timelineQueryOptions } from '@/entities/application';
import { notesQueryOptions } from '@/entities/note';
import { useSilenceDays, useUserTimeZone } from '@/entities/user';

import { timelineRowsOf } from '../lib/timeline-rows';
import { waitingRowOf } from '../lib/waiting-row';
import { useLinkedVersion } from './use-linked-version';

export function useApplicationTimeline(application: ApplicationResponse) {
  const timeline = useQuery(timelineQueryOptions(application.id));
  const notes = useQuery(notesQueryOptions(application.id));
  const linkedVersion = useLinkedVersion(application);
  const silenceDays = useSilenceDays();
  const timeZone = useUserTimeZone();
  const [mountedAt] = useState(Date.now);
  const items = timeline.data?.items ?? [];
  const load = sectionLoadOf(timeline);
  const rows = timelineRowsOf({
    items,
    application,
    notes: notes.data?.items ?? [],
    linkedVersion,
  });
  const waiting = waitingRowOf({ application, silenceDays, timeZone });
  return {
    rows,
    waiting,
    count: rows.length + (waiting === null ? 0 : 1),
    latestInterviewId: items.find((item) => item.type === 'interview_done')?.id,
    now: new Date(Math.max(timeline.dataUpdatedAt, mountedAt)),
    timeZone,
    load,
  };
}

export type ApplicationTimelineState = ReturnType<typeof useApplicationTimeline>;
