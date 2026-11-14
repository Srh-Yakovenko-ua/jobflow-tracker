import { isDeepStrictEqual } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  type DemoStory,
  type DemoStoryApplication,
  loadDemoStory,
  openDemoJourneys,
  parseDemoStory,
  shiftStory,
} from './demo-story.js';

const lastStageOf = ({ events }: DemoStoryApplication) => events.at(-1)?.toStage;

const instantsOf = ({ applications }: DemoStory) =>
  applications.flatMap(({ events }) => events.map(({ occurredAt }) => occurredAt.getTime()));

const journeyStory = (events: Array<{ fromStage: string | null; toStage: string }>) => ({
  now: '2026-08-28T12:00:00Z',
  searchStartedAt: '2026-06-05T06:00:00Z',
  timezone: 'Europe/Kyiv',
  resumeVersions: [{ number: 1, title: 'хронологічне' }],
  applications: [
    {
      key: 'application-0',
      source: 'djinni',
      url: 'https://djinni.co/jobs/71000-frontend-developer/',
      resumeVersion: 1,
      events: events.map((event) => ({
        ...event,
        reasonCode: null,
        occurredAt: '2026-06-05T09:00:00Z',
      })),
    },
  ],
});

describe('the demo story', () => {
  it('loads the AN-17 export with 54 journeys and their outcomes', async () => {
    const story = await loadDemoStory();
    const outcomeCount = (stage: string) =>
      story.applications.filter((application) => lastStageOf(application) === stage).length;

    expect(story.applications).toHaveLength(54);
    expect(story.resumeVersions.map(({ number }) => number)).toEqual([1, 2, 3]);
    expect({
      rejected: outcomeCount('rejected'),
      ghosted: outcomeCount('ghosted'),
      withdrawn: outcomeCount('withdrawn'),
      offer: outcomeCount('offer'),
    }).toEqual({ rejected: 32, ghosted: 17, withdrawn: 4, offer: 1 });
  });

  it('opens the four withdrawn journeys at their last stage and leaves every other journey as it was', async () => {
    const story = await loadDemoStory();
    const opened = openDemoJourneys(story);
    const changed = opened.applications.filter(
      (journey, index) => !isDeepStrictEqual(journey, story.applications[index]),
    );

    expect(opened.applications).toHaveLength(54);
    expect(changed.map((journey) => `${journey.key} ${String(lastStageOf(journey))}`)).toEqual([
      'application-17 screening',
      'application-18 applied',
      'application-19 applied',
      'application-34 final',
    ]);
    expect(changed.map(({ events }) => events.length)).toEqual([2, 1, 1, 4]);
  });

  it.each([
    {
      name: 'a move canTransition refuses',
      events: [
        { fromStage: null, toStage: 'applied' },
        { fromStage: 'applied', toStage: 'rejected' },
        { fromStage: 'rejected', toStage: 'screening' },
      ],
      refusal: /application-0: rejected -> screening refused \(terminal_stage\)/,
    },
    {
      name: 'a step that does not follow the last stage',
      events: [
        { fromStage: null, toStage: 'applied' },
        { fromStage: 'screening', toStage: 'tech_interview' },
      ],
      refusal: /application-0: screening -> tech_interview refused \(does not follow applied\)/,
    },
    {
      name: 'a journey that does not start at applied',
      events: [{ fromStage: null, toStage: 'screening' }],
      refusal: /application-0: start -> screening refused \(does not start at applied\)/,
    },
  ])('refuses $name', ({ events, refusal }) => {
    expect(() => parseDemoStory(journeyStory(events))).toThrow(refusal);
  });

  it('shifts every timestamp by the exact delta from the story now', async () => {
    const story = await loadDemoStory();
    const eightyFourDays = 84 * 24 * 60 * 60 * 1000 + 250;
    const shifted = shiftStory(story, { now: new Date('2026-11-20T12:00:00.250Z') });

    expect(shifted.now.toISOString()).toBe('2026-11-20T12:00:00.250Z');
    expect(shifted.searchStartedAt.toISOString()).toBe('2026-08-28T06:00:00.250Z');
    expect(
      shifted.applications[0]?.events.map(({ occurredAt }) => occurredAt.toISOString()),
    ).toEqual(['2026-08-28T09:00:00.250Z', '2026-08-30T09:00:00.250Z']);
    expect(instantsOf(shifted)).toEqual(
      instantsOf(story).map((instant) => instant + eightyFourDays),
    );
    expect(story.now.toISOString()).toBe('2026-08-28T12:00:00.000Z');
  });
});
