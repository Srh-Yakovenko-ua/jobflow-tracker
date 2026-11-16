'use client';

import { type ApplicationResponse, isActiveStage } from '@jobflow/shared';

import { applicationFollowupQueryOptions, useAiSection } from '@/entities/application';

function followupShown(application: ApplicationResponse): boolean {
  return !application.isDraft && isActiveStage(application.currentStage);
}

export function useApplicationFollowup(application: ApplicationResponse) {
  return useAiSection({
    query: applicationFollowupQueryOptions(application.id),
    shown: followupShown(application),
  });
}
