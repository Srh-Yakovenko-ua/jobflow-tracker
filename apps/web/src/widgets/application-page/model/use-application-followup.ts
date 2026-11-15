'use client';

import { type ApplicationResponse, isActiveStage } from '@jobflow/shared';

import { applicationFollowupQueryOptions } from '@/entities/application';

import { useAiSection } from './ai-poll';

function followupShown(application: ApplicationResponse): boolean {
  return !application.isDraft && isActiveStage(application.currentStage);
}

export function useApplicationFollowup(application: ApplicationResponse) {
  return useAiSection({
    query: applicationFollowupQueryOptions(application.id),
    shown: followupShown(application),
  });
}
