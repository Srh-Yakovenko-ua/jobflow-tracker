'use client';

import { type ApplicationResponse, isActiveStage } from '@jobflow/shared';

import { applicationAiQueryOptions, useAiSection } from '@/entities/application';

function followupShown(application: ApplicationResponse): boolean {
  return !application.isDraft && isActiveStage(application.currentStage);
}

export function useApplicationFollowup(application: ApplicationResponse) {
  return useAiSection({
    query: applicationAiQueryOptions({ id: application.id, segment: 'followup' }),
    shown: followupShown(application),
  });
}
