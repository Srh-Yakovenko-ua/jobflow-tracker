import { readFile } from 'node:fs/promises';

import {
  canTransition,
  rejectionReasonCodeSchema,
  sourceSchema,
  type Stage,
  stageSchema,
} from '@jobflow/shared';
import { z } from 'zod';

const STORY_URL = new URL(
  '../../../../services/analytics/tests/golden/design_story.json',
  import.meta.url,
);

const instantSchema = z.iso.datetime().transform((value) => new Date(value));

const storyEventSchema = z.object({
  fromStage: stageSchema.nullable(),
  toStage: stageSchema,
  reasonCode: rejectionReasonCodeSchema.nullable(),
  occurredAt: instantSchema,
});

const storyApplicationSchema = z.object({
  key: z.string().min(1),
  source: sourceSchema,
  url: z.url(),
  resumeVersion: z.int().positive(),
  events: z.array(storyEventSchema).min(1),
});

const demoStorySchema = z.object({
  now: instantSchema,
  searchStartedAt: instantSchema,
  timezone: z.string().min(1),
  resumeVersions: z
    .array(z.object({ number: z.int().positive(), title: z.string().min(1) }))
    .min(1),
  applications: z.array(storyApplicationSchema).min(1),
});

export type DemoStory = z.infer<typeof demoStorySchema>;

export type DemoStoryApplication = DemoStory['applications'][number];

export type DemoStoryEvent = DemoStoryApplication['events'][number];

export type ShiftStoryInput = { now: Date };

function stepRefusal(previous: Stage | null, { fromStage, toStage }: DemoStoryEvent) {
  if (fromStage !== previous) {
    return `does not follow ${previous ?? 'start'}`;
  }
  if (fromStage === null) {
    return toStage === 'applied' ? null : 'does not start at applied';
  }
  const verdict = canTransition(fromStage, toStage);
  return verdict.ok ? null : verdict.reason;
}

function assertLegalJourney({ key, events }: DemoStoryApplication): void {
  let previous: Stage | null = null;
  for (const event of events) {
    const refusal = stepRefusal(previous, event);
    if (refusal) {
      throw new Error(
        `${key}: ${event.fromStage ?? 'start'} -> ${event.toStage} refused (${refusal})`,
      );
    }
    previous = event.toStage;
  }
}

export function parseDemoStory(raw: unknown): DemoStory {
  const story = demoStorySchema.parse(raw);
  story.applications.forEach(assertLegalJourney);
  return story;
}

export async function loadDemoStory(): Promise<DemoStory> {
  return parseDemoStory(JSON.parse(await readFile(STORY_URL, 'utf8')));
}

const withoutWithdrawal = (events: DemoStoryEvent[]) =>
  events.at(-1)?.toStage === 'withdrawn' ? events.slice(0, -1) : events;

export function openDemoJourneys(story: DemoStory): DemoStory {
  return {
    ...story,
    applications: story.applications.map((application) => ({
      ...application,
      events: withoutWithdrawal(application.events),
    })),
  };
}

export function shiftStory(story: DemoStory, { now }: ShiftStoryInput): DemoStory {
  const delta = now.getTime() - story.now.getTime();
  const moved = (instant: Date) => new Date(instant.getTime() + delta);
  return {
    ...story,
    now: moved(story.now),
    searchStartedAt: moved(story.searchStartedAt),
    applications: story.applications.map((application) => ({
      ...application,
      events: application.events.map((event) => ({
        ...event,
        occurredAt: moved(event.occurredAt),
      })),
    })),
  };
}
