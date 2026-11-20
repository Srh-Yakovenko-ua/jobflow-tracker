'use client';

import type { Plan } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type ApplicationCardContext,
  boardQueryOptions,
  SILENT_ONLY,
} from '@/entities/application';
import { latestPlanQueryOptions } from '@/entities/plan';
import { remindersQueryOptions } from '@/entities/reminder';
import {
  calendarQueryOptions,
  interviewRangeFrom,
  type UpcomingInterview,
  upcomingInterviewsOf,
} from '@/entities/scheduled-event';
import { useSettledTimeZone, useSilenceDays } from '@/entities/user';
import { type SilentRow, silentRowsOf } from '@/features/snooze-reminder';
import { type SectionLoad, sectionLoadOf } from '@/shared/lib/section-load';

import { useReplyMove } from './use-reply-move';

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

function useSilenceSection(now: Date): SilenceSection {
  const board = useQuery(boardQueryOptions(SILENT_ONLY));
  const reminders = useQuery(remindersQueryOptions());
  const rows =
    board.data &&
    reminders.data &&
    silentRowsOf({ board: board.data, reminders: reminders.data.items, now });
  return { rows, load: sectionLoadOf(board, reminders), silenceDays: useSilenceDays() };
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
  return { view, load: sectionLoadOf(calendar) };
}

function usePlanSection(): PlanSectionState {
  const latest = useQuery(latestPlanQueryOptions());
  const timeZone = useSettledTimeZone();
  const view = latest.data && timeZone !== null ? { plan: latest.data.plan, timeZone } : undefined;
  return { view, load: sectionLoadOf(latest) };
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
