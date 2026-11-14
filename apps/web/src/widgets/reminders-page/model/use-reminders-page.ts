'use client';

import type { CalendarQuery, Plan } from '@jobflow/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { useState } from 'react';

import {
  type ApplicationCardContext,
  boardQueryOptions,
  SILENT_ONLY,
} from '@/entities/application';
import { latestPlanQueryOptions } from '@/entities/plan';
import { remindersQueryOptions } from '@/entities/reminder';
import { calendarQueryOptions } from '@/entities/scheduled-event';
import { useSettledTimeZone, useSilenceDays } from '@/entities/user';

import { type SilentRow, silentRowsOf } from '../lib/silent-rows';
import { type UpcomingInterview, upcomingInterviewsOf } from '../lib/upcoming-interviews';
import { useReplyMove } from './use-reply-move';

const INTERVIEW_WINDOW_DAYS = 14;

export type SectionLoad = Readonly<{ failed: boolean; retrying: boolean; onRetry: () => void }>;

export type SilenceSection = Readonly<{
  rows: SilentRow[] | undefined;
  load: SectionLoad;
  silenceDays: number;
}>;

export type InterviewsView = Readonly<{
  rows: UpcomingInterview[];
  context: ApplicationCardContext;
}>;

export type InterviewsSection = Readonly<{ view: InterviewsView | undefined; load: SectionLoad }>;

export type PlanView = Readonly<{ plan: Plan | null; timeZone: string }>;

export type PlanSectionState = Readonly<{ view: PlanView | undefined; load: SectionLoad }>;

function loadOf(queries: readonly UseQueryResult[]): SectionLoad {
  return {
    failed: queries.some((query) => query.isError),
    retrying: queries.some((query) => query.isFetching),
    onRetry: () => {
      queries.filter((query) => query.isError).forEach((query) => void query.refetch());
    },
  };
}

function interviewRangeFrom(now: Date): CalendarQuery {
  return { from: now.toISOString(), to: addDays(now, INTERVIEW_WINDOW_DAYS).toISOString() };
}

function useSilenceSection(now: Date): SilenceSection {
  const board = useQuery(boardQueryOptions(SILENT_ONLY));
  const reminders = useQuery(remindersQueryOptions());
  const rows =
    board.data &&
    reminders.data &&
    silentRowsOf({ board: board.data, reminders: reminders.data.items, now });
  return { rows, load: loadOf([board, reminders]), silenceDays: useSilenceDays() };
}

function useInterviewsSection(now: Date): InterviewsSection {
  const [range] = useState(() => interviewRangeFrom(now));
  const calendar = useQuery(calendarQueryOptions(range));
  const timeZone = useSettledTimeZone();
  const view =
    calendar.data && timeZone !== null
      ? {
          rows: upcomingInterviewsOf({ items: calendar.data.items, now }),
          context: { now, timeZone },
        }
      : undefined;
  return { view, load: loadOf([calendar]) };
}

function usePlanSection(): PlanSectionState {
  const latest = useQuery(latestPlanQueryOptions());
  const timeZone = useSettledTimeZone();
  const view = latest.data && timeZone !== null ? { plan: latest.data.plan, timeZone } : undefined;
  return { view, load: loadOf([latest]) };
}

export function useRemindersPage() {
  const [now] = useState(() => new Date());
  return {
    silence: useSilenceSection(now),
    interviews: useInterviewsSection(now),
    plan: usePlanSection(),
    reply: useReplyMove(),
  };
}
