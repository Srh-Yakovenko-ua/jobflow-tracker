'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { applicationInterviewPrepQueryOptions } from '@/entities/application';

import { useAiSection } from './ai-poll';
import { useApplicationSchedule } from './use-application-schedule';

export function useApplicationInterviewPrep(application: ApplicationResponse) {
  const { agenda } = useApplicationSchedule(application);
  return useAiSection({
    query: applicationInterviewPrepQueryOptions(application.id),
    shown: agenda.upcoming !== undefined,
  });
}
