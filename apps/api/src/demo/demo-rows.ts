import {
  type ScheduledEventKind,
  type ScheduledEventStatus,
  type Source,
  type Stage,
  userNow,
  type WorkMode,
} from '@jobflow/shared';
import { addHours, min, startOfMonth } from 'date-fns';

import type { DemoStory, DemoStoryApplication, DemoStoryEvent } from './demo-story.js';
import { DEMO_APPLICATION_TEXTS } from './demo-texts.js';

export type DemoStageEventRow = DemoStoryEvent & { createdAt: Date };

export type DemoNoteRow = { body: string; createdAt: Date };

export type DemoScheduledEventRow = {
  kind: ScheduledEventKind;
  startsAt: Date;
  status: ScheduledEventStatus;
  createdAt: Date;
};

export type DemoApplicationRow = {
  company: string;
  position: string;
  url: string;
  source: Source;
  stack: string[];
  workMode: WorkMode;
  currentStage: Stage;
  appliedAt: Date;
  lastEventAt: Date;
  createdAt: Date;
  stageEvents: DemoStageEventRow[];
  notes: DemoNoteRow[];
  scheduledEvents: DemoScheduledEventRow[];
};

export type DemoApplicationPlan = { resumeVersion: number; row: DemoApplicationRow };

export type DemoVersionRow = { number: number; title: string; uploadedAt: Date };

const HOUR_MS = 60 * 60 * 1000;

const DAY_MS = 24 * HOUR_MS;

const DEMO_TIMES = { interviewAfterDays: 1, uploadBeforeHours: 3, summaryLocalHour: 4 } as const;

const INTERVIEW_KIND_OF: Partial<Record<Stage, ScheduledEventKind>> = {
  tech_interview: 'tech_interview',
  final: 'final_interview',
};

type JourneyAt = { events: DemoStoryEvent[]; now: Date };

type StoryPlace = { index: number; now: Date };

const daysAfter = (instant: Date, days: number) => new Date(instant.getTime() + days * DAY_MS);

function doneInterviewsOf(events: DemoStoryEvent[]): DemoScheduledEventRow[] {
  return events.flatMap(({ toStage, occurredAt }) => {
    const kind = INTERVIEW_KIND_OF[toStage];
    if (kind === undefined) {
      return [];
    }
    const startsAt = daysAfter(occurredAt, DEMO_TIMES.interviewAfterDays);
    return [{ kind, startsAt, status: 'done', createdAt: occurredAt }];
  });
}

function scheduledEventsOf(currentStage: Stage, { events, now }: JourneyAt) {
  const interviews = doneInterviewsOf(events);
  if (currentStage !== 'offer') {
    return interviews;
  }
  const startsAt = daysAfter(now, DEMO_TIMES.interviewAfterDays);
  const offerCall: DemoScheduledEventRow = {
    kind: 'offer_call',
    startsAt,
    status: 'planned',
    createdAt: now,
  };
  return [...interviews, offerCall];
}

function edgesOf(events: DemoStoryEvent[]) {
  const [first] = events;
  const last = events.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error('A demo journey has no events');
  }
  return { first, last };
}

function applicationPlanOf(
  application: DemoStoryApplication,
  { index, now }: StoryPlace,
): DemoApplicationPlan {
  const text = DEMO_APPLICATION_TEXTS[index];
  if (text === undefined) {
    throw new Error(`${application.key} has no demo text`);
  }
  const { events, url, source, resumeVersion } = application;
  const { first, last } = edgesOf(events);
  const scheduledEvents = scheduledEventsOf(last.toStage, { events, now });
  const noteAt = scheduledEvents[0]?.startsAt ?? last.occurredAt;
  const { company, position, stack, workMode, liveCodingNote } = text;
  const row: DemoApplicationRow = {
    company,
    position,
    url,
    source,
    stack: [...stack],
    workMode,
    currentStage: last.toStage,
    appliedAt: first.occurredAt,
    lastEventAt: last.occurredAt,
    createdAt: first.occurredAt,
    stageEvents: events.map((event) => ({ ...event, createdAt: event.occurredAt })),
    notes: liveCodingNote === null ? [] : [{ body: liveCodingNote, createdAt: noteAt }],
    scheduledEvents,
  };
  return { resumeVersion, row };
}

export function applicationPlansOf({ applications, now }: DemoStory): DemoApplicationPlan[] {
  return applications.map((application, index) => applicationPlanOf(application, { index, now }));
}

export function versionRowsOf({
  resumeVersions,
  applications,
  searchStartedAt,
}: DemoStory): DemoVersionRow[] {
  return resumeVersions.map(({ number, title }): DemoVersionRow => {
    const applied = applications
      .filter(({ resumeVersion }) => resumeVersion === number)
      .map(({ events }) => edgesOf(events).first.occurredAt);
    const firstApplied = applied.length === 0 ? searchStartedAt : min(applied);
    const uploadedAt = new Date(firstApplied.getTime() - DEMO_TIMES.uploadBeforeHours * HOUR_MS);
    return { number, title, uploadedAt };
  });
}

export function summaryInstantOf({ now, timezone }: DemoStory): Date {
  const monthStart = startOfMonth(userNow({ timezone }, now));
  const summaryAt = addHours(monthStart, DEMO_TIMES.summaryLocalHour);
  return new Date(Math.min(summaryAt.getTime(), now.getTime()));
}
