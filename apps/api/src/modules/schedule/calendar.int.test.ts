import { type CalendarItem, calendarResponseSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { addMinutes } from '../../common/add-minutes.js';
import { useTestApp } from '../../test/app.js';
import {
  applicationPath,
  CALENDAR_PATH,
  createApplication,
  getWithQuery,
  ROMASHKA,
  type SignedInApplication,
  signUpWithApplication,
} from '../../test/applications.js';
import { BOHDAN } from '../../test/auth.js';
import { createReminder, createScheduledEvent, type NewReminder } from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';

type CalendarRange = { from: string; to: string };

type EdgeEvent = { name: string; startsAt: string; durationMin: number };

type ReminderInput = Omit<NewReminder, 'userId' | 'applicationId'>;

type FollowupCase = {
  case: string;
  followup: Omit<ReminderInput, 'type' | 'scheduledEventId'>;
  startsOn: string[];
};

const KYIV_WEEK = { from: '2026-10-19T00:00:00+03:00', to: '2026-10-26T00:00:00+02:00' };

const NEW_YORK_WEEK = { from: '2026-10-26T00:00:00-04:00', to: '2026-11-02T00:00:00-05:00' };

const NOVEMBER_FORTNIGHT = { from: '2026-11-02T00:00:00+02:00', to: '2026-11-16T00:00:00+02:00' };

const INSIDE_KYIV_WEEK = new Date('2026-10-21T09:00:00.000Z');

const shifted = (at: string, minutes: number) => addMinutes(new Date(at), minutes).toISOString();

const edgeEventsOf = ({ from, to }: CalendarRange): EdgeEvent[] => [
  { name: 'ends as the range starts', startsAt: shifted(from, -60), durationMin: 60 },
  { name: 'ends 1 minute into the range', startsAt: shifted(from, -59), durationMin: 60 },
  { name: 'starts 1 minute into the range', startsAt: shifted(from, 1), durationMin: 30 },
  { name: 'starts 1 minute before the range ends', startsAt: shifted(to, -1), durationMin: 30 },
  { name: 'starts as the range ends', startsAt: to, durationMin: 30 },
];

describe('GET /calendar', () => {
  const testApp = useTestApp();

  const calendarOf = (accessToken: string, range: CalendarRange) =>
    getWithQuery(testApp.app, { path: CALENDAR_PATH, accessToken, query: range });

  async function itemsOf(accessToken: string, range: CalendarRange): Promise<CalendarItem[]> {
    const response = await calendarOf(accessToken, range);
    expect(response.status).toBe(200);
    return calendarResponseSchema.parse(response.body).items;
  }

  const userIdOf = async ({ id }: SignedInApplication) =>
    (
      await testApp.prisma.application.findUniqueOrThrow({
        where: { id },
        select: { userId: true },
      })
    ).userId;

  async function livingIn(timezone: string, application: SignedInApplication) {
    const userId = await userIdOf(application);
    await testApp.prisma.userSettings.update({ where: { userId }, data: { timezone } });
  }

  async function secondApplicationOf({ accessToken }: SignedInApplication) {
    const { id } = await createApplication(testApp.app, { accessToken, input: ROMASHKA });
    return { accessToken, id };
  }

  async function reminderOf(application: SignedInApplication, reminder: ReminderInput) {
    const userId = await userIdOf(application);
    return createReminder(testApp.prisma, { ...reminder, userId, applicationId: application.id });
  }

  const followupDue = (application: SignedInApplication, dueAt: string) =>
    reminderOf(application, { dueAt: new Date(dueAt) });

  async function interviewReminderInsideKyivWeek(application: SignedInApplication) {
    const startsAt = addMinutes(new Date(KYIV_WEEK.to), 60);
    const scheduledEventId = await createScheduledEvent(testApp.prisma, {
      applicationId: application.id,
      kind: 'tech_interview',
      startsAt,
    });
    const dueAt = addMinutes(startsAt, -120);
    return reminderOf(application, { type: 'interview_soon', scheduledEventId, dueAt });
  }

  async function plannedEvents(applicationId: string, events: EdgeEvent[]) {
    const ids = new Map<string, string>();
    for (const { name, startsAt, durationMin } of events) {
      const id = await createScheduledEvent(testApp.prisma, {
        applicationId,
        kind: 'screening_call',
        startsAt: new Date(startsAt),
        durationMin,
      });
      ids.set(id, name);
    }
    return ids;
  }

  it.each([
    { case: 'a Kyiv week across the switch to winter time', range: KYIV_WEEK },
    { case: 'a New York week across the switch to winter time', range: NEW_YORK_WEEK },
  ])(
    'includes the events that overlap $case and leaves out those that only touch it',
    async ({ range }) => {
      const application = await signUpWithApplication(testApp.app);
      const names = await plannedEvents(application.id, edgeEventsOf(range));

      const items = await itemsOf(application.accessToken, range);

      expect(items.map(({ id }) => names.get(id))).toEqual([
        'ends 1 minute into the range',
        'starts 1 minute into the range',
        'starts 1 minute before the range ends',
      ]);
    },
  );

  it('answers an event as a timed item in UTC with its application, kind, status and place', async () => {
    const application = await signUpWithApplication(testApp.app);
    const id = await createScheduledEvent(testApp.prisma, {
      applicationId: application.id,
      kind: 'tech_interview',
      startsAt: new Date('2026-10-21T13:00:00.000Z'),
      durationMin: 90,
    });

    const items = await itemsOf(application.accessToken, KYIV_WEEK);

    expect(items).toEqual([
      {
        id,
        title: "Техінтерв'ю · Ромашка",
        start: '2026-10-21T13:00:00.000Z',
        end: '2026-10-21T14:30:00.000Z',
        allDay: false,
        extendedProps: {
          type: 'scheduled_event',
          applicationId: application.id,
          company: 'Ромашка',
          stage: 'applied',
          eventKind: 'tech_interview',
          status: 'planned',
          locationOrLink: null,
        },
      },
    ]);
  });

  it('answers a follow-up as an all-day item dated in the Kyiv time zone of the settings', async () => {
    const application = await signUpWithApplication(testApp.app);
    const lateEvening = await followupDue(application, '2026-11-08T21:30:00.000Z');
    const pastMidnight = await followupDue(
      await secondApplicationOf(application),
      '2026-11-08T22:30:00.000Z',
    );

    const items = await itemsOf(application.accessToken, NOVEMBER_FORTNIGHT);

    expect(items).toEqual([
      {
        id: lateEvening,
        title: 'Фоллоу-ап · Ромашка',
        start: '2026-11-08',
        end: null,
        allDay: true,
        extendedProps: {
          type: 'followup',
          applicationId: application.id,
          company: 'Ромашка',
          stage: 'applied',
          reminderStatus: 'pending',
        },
      },
      expect.objectContaining({ id: pastMidnight, start: '2026-11-09', allDay: true }),
    ]);
  });

  it('dates both follow-ups on November 8 for a user in New York', async () => {
    const application = await signUpWithApplication(testApp.app);
    await livingIn('America/New_York', application);
    await followupDue(application, '2026-11-08T21:30:00.000Z');
    await followupDue(await secondApplicationOf(application), '2026-11-08T22:30:00.000Z');

    const items = await itemsOf(application.accessToken, NOVEMBER_FORTNIGHT);

    expect(items.map(({ start }) => start)).toEqual(['2026-11-08', '2026-11-08']);
  });

  it.each<FollowupCase>([
    {
      case: 'shows a pending follow-up due inside the range',
      followup: { dueAt: INSIDE_KYIV_WEEK },
      startsOn: ['2026-10-21'],
    },
    {
      case: 'leaves out a dismissed follow-up due inside the range',
      followup: { status: 'dismissed', dueAt: INSIDE_KYIV_WEEK },
      startsOn: [],
    },
    {
      case: 'leaves out a done follow-up due inside the range',
      followup: { status: 'done', dueAt: INSIDE_KYIV_WEEK },
      startsOn: [],
    },
    {
      case: 'shows a follow-up due before the range on the day it is snoozed until inside it',
      followup: {
        status: 'snoozed',
        dueAt: new Date('2026-10-17T09:00:00.000Z'),
        snoozedUntil: new Date('2026-10-23T09:00:00.000Z'),
      },
      startsOn: ['2026-10-23'],
    },
    {
      case: 'leaves out a follow-up due inside the range and snoozed past it',
      followup: {
        status: 'snoozed',
        dueAt: INSIDE_KYIV_WEEK,
        snoozedUntil: new Date('2026-10-27T09:00:00.000Z'),
      },
      startsOn: [],
    },
  ])('$case and never an interview reminder', async ({ followup, startsOn }) => {
    const application = await signUpWithApplication(testApp.app);
    await interviewReminderInsideKyivWeek(application);
    const followupId = await reminderOf(application, followup);

    const items = await itemsOf(application.accessToken, KYIV_WEEK);

    expect(items.map(({ id, start, allDay }) => [id, start, allDay])).toEqual(
      startsOn.map((start) => [followupId, start, true]),
    );
  });

  it('keeps a done event and leaves out a cancelled one', async () => {
    const application = await signUpWithApplication(testApp.app);
    const startsAt = new Date('2026-10-21T13:00:00.000Z');
    const event = { applicationId: application.id, kind: 'final_interview', startsAt } as const;
    const done = await createScheduledEvent(testApp.prisma, { ...event, status: 'done' });
    await createScheduledEvent(testApp.prisma, { ...event, status: 'cancelled' });

    const items = await itemsOf(application.accessToken, KYIV_WEEK);

    expect(items.map(({ id, extendedProps }) => [id, extendedProps])).toEqual([
      [done, expect.objectContaining({ status: 'done' })],
    ]);
  });

  it("answers BOHDAN's calendar without OLENA's events and follow-ups", async () => {
    const olena = await signUpWithApplication(testApp.app);
    const bohdan = await signUpWithApplication(testApp.app, BOHDAN);
    await plannedEvents(olena.id, edgeEventsOf(KYIV_WEEK));
    await followupDue(olena, '2026-10-21T09:00:00.000Z');
    const own = await followupDue(bohdan, '2026-10-22T09:00:00.000Z');

    const items = await itemsOf(bohdan.accessToken, KYIV_WEEK);

    expect(items.map(({ id }) => id)).toEqual([own]);
  });

  it('leaves out the events and follow-ups of a soft-deleted application', async () => {
    const application = await signUpWithApplication(testApp.app);
    await plannedEvents(application.id, edgeEventsOf(KYIV_WEEK));
    await followupDue(application, '2026-10-21T09:00:00.000Z');
    await callRoute(testApp.app, {
      method: 'delete',
      path: applicationPath(application.id),
      accessToken: application.accessToken,
    });

    expect(await itemsOf(application.accessToken, KYIV_WEEK)).toEqual([]);
  });

  it('answers 401 without a token', async () => {
    const response = await getWithQuery(testApp.app, { path: CALENDAR_PATH, query: KYIV_WEEK });

    expect(response.status).toBe(401);
  });

  it.each([
    {
      case: 'a from with no offset',
      query: { ...KYIV_WEEK, from: '2026-10-19T00:00:00' },
      path: 'from',
    },
    { case: 'no to', query: { from: KYIV_WEEK.from }, path: 'to' },
    { case: 'a to equal to from', query: { ...KYIV_WEEK, to: KYIV_WEEK.from }, path: 'to' },
    {
      case: 'a range of 63 days',
      query: { from: '2026-10-01T00:00:00Z', to: '2026-12-03T00:00:00Z' },
      path: 'to',
    },
  ])('answers $case with 422 at $path', async ({ query, path }) => {
    const { accessToken } = await signUpWithApplication(testApp.app);

    const response = await getWithQuery(testApp.app, { path: CALENDAR_PATH, accessToken, query });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, [path]]);
  });

  it('accepts a range of exactly 62 days', async () => {
    const { accessToken } = await signUpWithApplication(testApp.app);
    const range = { from: '2026-10-01T00:00:00Z', to: '2026-12-02T00:00:00Z' };

    expect(await itemsOf(accessToken, range)).toEqual([]);
  });
});
