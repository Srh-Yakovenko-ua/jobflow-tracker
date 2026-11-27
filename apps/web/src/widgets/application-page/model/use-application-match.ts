'use client';

import type { ApplicationMatchResponse, ApplicationResponse, ResumeVersion } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { aiJobOf, applicationAiQueryOptions, jobQueryOptions } from '@/entities/application';
import { useLivePollMs } from '@/shared/api';
import { sectionLoadOf } from '@/shared/lib/section-load';

import { type MatchView, matchViewOf } from '../lib/match-view';
import { useDayLabel } from './use-day-label';
import { useLinkedVersion } from './use-linked-version';

export function useApplicationMatch(application: ApplicationResponse) {
  const pollMs = useLivePollMs();
  const [relinkedTo, setRelinkedTo] = useState<ResumeVersion['id'] | null>(null);
  const versionProfileStatus = useLinkedVersion(application)?.aiProfileStatus;
  const viewOf = (response: ApplicationMatchResponse): MatchView =>
    matchViewOf({
      resumeVersionId: application.resumeVersionId,
      response,
      relinkedTo,
      versionProfileStatus,
      isDraft: application.isDraft,
      vacancy: application,
    });
  const match = useQuery({
    ...applicationAiQueryOptions({ id: application.id, segment: 'match' }),
    refetchInterval: ({ state }) =>
      state.data !== undefined && viewOf(state.data).kind === 'pending' ? pollMs : false,
  });
  const view = match.data === undefined ? null : viewOf(match.data);
  const jobId = view?.kind === 'pending' ? (view.job?.id ?? null) : null;
  const job = useQuery({ ...jobQueryOptions(jobId), refetchInterval: pollMs });
  return {
    load: sectionLoadOf(match),
    view,
    job: aiJobOf(job.data),
    dayLabel: useDayLabel(match),
    onRelinked: setRelinkedTo,
  };
}

export type ApplicationMatchState = ReturnType<typeof useApplicationMatch>;
