'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import { applicationAiQueryOptions, useAiSection } from '@/entities/application';
import { sectionLoadOf } from '@/shared/lib/section-load';

import { interviewPrepGateOf } from '../lib/interview-prep-gate';
import { useApplicationSchedule } from './use-application-schedule';

export function useApplicationInterviewPrep(application: ApplicationResponse) {
  const schedule = useApplicationSchedule(application);
  const match = useQuery(applicationAiQueryOptions({ id: application.id, segment: 'match' }));
  const gate = interviewPrepGateOf({
    application,
    schedule: { load: schedule.load, upcoming: schedule.agenda.upcoming !== undefined },
    match: { load: sectionLoadOf(match), response: match.data },
  });
  const section = useAiSection({
    query: applicationAiQueryOptions({ id: application.id, segment: 'interview-prep' }),
    shown: gate.shown,
  });
  const pending = section.load.pending || gate.settling;
  const busy = section.load.busy || gate.settling;
  return {
    section: { ...section, load: { ...section.load, pending, busy } },
    requestable: gate.requestable,
  };
}
