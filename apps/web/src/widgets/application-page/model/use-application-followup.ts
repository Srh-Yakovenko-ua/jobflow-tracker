'use client';

import { type ApplicationResponse, type FollowupResponse, isActiveStage } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { aiJobOf, applicationFollowupQueryOptions, jobQueryOptions } from '@/entities/application';
import { followupWaiting } from '@/features/generate-followup';
import { useLivePollMs } from '@/shared/api';

import { sectionLoadOf } from './section-load';

function followupShown(application: ApplicationResponse): boolean {
  return !application.isDraft && isActiveStage(application.currentStage);
}

function waitingIn(data: FollowupResponse | undefined): boolean {
  return data !== undefined && followupWaiting(data);
}

export function useApplicationFollowup(application: ApplicationResponse) {
  const pollMs = useLivePollMs();
  const shown = followupShown(application);
  const followup = useQuery({
    ...applicationFollowupQueryOptions(application.id),
    enabled: shown,
    refetchOnMount: ({ state }) => (waitingIn(state.data) ? 'always' : true),
    refetchInterval: ({ state }) => (waitingIn(state.data) ? pollMs : false),
  });
  const waitingJob = waitingIn(followup.data) ? (followup.data?.job ?? null) : null;
  const job = useQuery({ ...jobQueryOptions(waitingJob?.id ?? null), refetchInterval: pollMs });
  return {
    shown,
    load: sectionLoadOf(followup),
    response: followup.data,
    job: aiJobOf(job.data),
  };
}

export type ApplicationFollowupState = ReturnType<typeof useApplicationFollowup>;
