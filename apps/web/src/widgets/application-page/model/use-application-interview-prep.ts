'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';

import {
  applicationInterviewPrepQueryOptions,
  applicationMatchQueryOptions,
} from '@/entities/application';

import { interviewPrepGateOf } from '../lib/interview-prep-gate';
import { useAiSection } from './ai-poll';
import { sectionLoadOf } from './section-load';
import { useApplicationSchedule } from './use-application-schedule';

export function useApplicationInterviewPrep(application: ApplicationResponse) {
  const schedule = useApplicationSchedule(application);
  const match = useQuery(applicationMatchQueryOptions(application.id));
  const gate = interviewPrepGateOf({
    application,
    schedule: { load: schedule.load, upcoming: schedule.agenda.upcoming !== undefined },
    match: { load: sectionLoadOf(match), response: match.data },
  });
  const section = useAiSection({
    query: applicationInterviewPrepQueryOptions(application.id),
    shown: gate.shown,
  });
  const pending = section.load.pending || gate.settling;
  return {
    section: { ...section, load: { ...section.load, pending } },
    requestable: gate.requestable,
  };
}
