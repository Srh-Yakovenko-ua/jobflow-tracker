'use client';

import { type ApplicationResponse, isActiveStage } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { aiJobOf, applicationFollowupQueryOptions, jobQueryOptions } from '@/entities/application';
import { followupWaiting } from '@/features/generate-followup';
import { useLivePollMs } from '@/shared/api';

import { sectionLoadOf } from './section-load';

function followupShown(application: ApplicationResponse): boolean {
  return !application.isDraft && isActiveStage(application.currentStage);
}

export function useApplicationFollowup(application: ApplicationResponse) {
  const pollMs = useLivePollMs();
  const shown = followupShown(application);
  const followup = useQuery({
    ...applicationFollowupQueryOptions(application.id),
    enabled: shown,
    refetchInterval: ({ state }) =>
      state.data !== undefined && followupWaiting(state.data) ? pollMs : false,
  });
  const waitingJob =
    followup.data !== undefined && followupWaiting(followup.data) ? followup.data.job : null;
  const job = useQuery({ ...jobQueryOptions(waitingJob?.id ?? null), refetchInterval: pollMs });
  return {
    shown,
    load: sectionLoadOf(followup),
    response: followup.data,
    job: aiJobOf(job.data),
  };
}

export type ApplicationFollowupState = ReturnType<typeof useApplicationFollowup>;
