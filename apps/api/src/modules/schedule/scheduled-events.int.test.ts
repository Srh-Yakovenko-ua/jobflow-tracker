import {
  applicationTimelineResponseSchema,
  type CreateScheduledEventInput,
  errorResponseSchema,
  scheduledEventListResponseSchema,
  scheduledEventSchema,
  scheduledEventUpdateResponseSchema,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import {
  applicationPath,
  foreignReaches,
  getApplicationBoard,
  postStageMove,
  scheduledEventPath,
  scheduledEventsPath,
  type ScheduledEventTarget,
  type SignedInApplication,
  signUpWithApplication,
  timelinePath,
  useStageMoveTestApp,
} from '../../test/applications.js';
import { callRoute, errorPathsOf, type RouteCall, statusAndDetail } from '../../test/http.js';
import { icsEventFieldsOf } from '../../test/ics.js';
import { minutesAfter, NOW, settableClock } from '../../test/time.js';

type SignedInEvent = SignedInApplication & ScheduledEventTarget;

type EventRoute = Omit<RouteCall, 'accessToken'>;

type EventRoutes = Record<'post' | 'get' | 'patch' | 'delete' | 'ics', EventRoute>;

const NOW_ISO = '2026-10-22T09:00:00.000Z';

const STARTS_AT = '2026-10-23T13:00:00.000Z';

const ENDS_AT = '2026-10-23T14:30:00.000Z';

const AFTER_THE_EVENT = new Date('2026-10-23T15:00:00.000Z');

const TECH_INTERVIEW = {
  kind: 'tech_interview',
  startsAt: '2026-10-23T16:00:00+03:00',
  durationMin: 90,
  locationOrLink: 'https://meet.google.com/abc-defg-hij',
} satisfies CreateScheduledEventInput;

const DONE = { status: 'done', outcomeNote: 'Питали про Kafka і CQRS' };

const SCHEDULED_ROW = {
  kind: 'interview_scheduled',
  payload: { kind: 'tech_interview', startsAt: STARTS_AT },
  occurredAt: NOW,
};

const MISSING_EVENT = [404, 'Scheduled event not found'];

const MISSING_APPLICATION = [404, 'Application not found'];

const CHANGED_MEANWHILE = [409, 'The scheduled event changed meanwhile, reload it and try again'];

const clock = settableClock(NOW);

const eventRoutes = (target: ScheduledEventTarget, body: object = DONE): EventRoutes => ({
  post: { method: 'post', path: scheduledEventsPath(target.id), body: TECH_INTERVIEW },
  get: { method: 'get', path: scheduledEventsPath(target.id) },
  patch: { method: 'patch', path: scheduledEventPath(target), body },
  delete: { method: 'delete', path: scheduledEventPath(target) },
  ics: { method: 'get', path: `${scheduledEventPath(target)}/ics` },
});

const startingIn = (minutes: number) => ({
  kind: 'screening_call',
  startsAt: minutesAfter(minutes).toISOString(),
});

describe('the scheduled events routes', () => {
  const testApp = useStageMoveTestApp(clock);

  const call = (accessToken: string, route: EventRoute) =>
    callRoute(testApp.app, { ...route, accessToken });

  const responsesOf = (accessToken: string, routes: EventRoute[]) =>
    Promise.all(routes.map((route) => call(accessToken, route)));

  const postEvent = ({ accessToken, id }: SignedInApplication, body: object) =>
    call(accessToken, { method: 'post', path: scheduledEventsPath(id), body });

  const patchEvent = (event: SignedInEvent, body: object) =>
    call(event.accessToken, eventRoutes(event, body).patch);

  const storedEvent = (eventId: string) =>
    testApp.prisma.scheduledEvent.findUniqueOrThrow({
      where: { id: eventId },
      select: { startsAt: true, durationMin: true, status: true, outcomeNote: true },
    });

  const journalRowsOf = (applicationId: string) =>
    testApp.prisma.timelineEvent.findMany({
      where: { applicationId, kind: { in: ['interview_scheduled', 'interview_done'] } },
      orderBy: { occurredAt: 'asc' },
      select: { kind: true, payload: true, occurredAt: true },
    });

  const remindersOf = (applicationId: string) =>
    testApp.prisma.reminder.findMany({
      where: { applicationId },
      orderBy: { dueAt: 'asc' },
      select: { type: true, status: true, dueAt: true, scheduledEventId: true },
    });

  async function lockWaiters(): Promise<number | undefined> {
    const [row] = await testApp.prisma.$queryRaw<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    return row?.waiting;
  }

  async function olenaWithEvent(body: object = TECH_INTERVIEW): Promise<SignedInEvent> {
    const application = await signUpWithApplication(testApp.app);
    const response = await postEvent(application, body);
    return { ...application, eventId: scheduledEventSchema.parse(response.body).id };
  }

  async function eventAtTechInterview(): Promise<SignedInEvent> {
    const event = await olenaWithEvent();
    const input = { fromStage: 'applied', toStage: 'tech_interview' };
    expect((await postStageMove(testApp.app, { ...event, input })).status).toBe(201);
    return event;
  }

  it('POST answers 201 with the planned event in UTC and journals interview_scheduled at the clock time', async () => {
    const application = await signUpWithApplication(testApp.app);

    const response = await postEvent(application, TECH_INTERVIEW);

    expect(response.status).toBe(201);
    const { id, ...event } = scheduledEventSchema.parse(response.body);
    expect(event).toEqual({
      applicationId: application.id,
      kind: 'tech_interview',
      startsAt: STARTS_AT,
      durationMin: 90,
      locationOrLink: TECH_INTERVIEW.locationOrLink,
      status: 'planned',
      outcomeNote: null,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect((await storedEvent(id)).startsAt).toEqual(new Date(STARTS_AT));
    expect(await journalRowsOf(application.id)).toEqual([SCHEDULED_ROW]);
  });

  it('POST arms one interview_soon reminder two hours before the start', async () => {
    const { id, eventId } = await olenaWithEvent();

    expect(await remindersOf(id)).toEqual([
      {
        type: 'interview_soon',
        status: 'pending',
        dueAt: new Date('2026-10-23T11:00:00.000Z'),
        scheduledEventId: eventId,
      },
    ]);
  });

  it('POST arms no reminder for an event 10 minutes away and a 15-minute one for an event an hour away', async () => {
    const application = await signUpWithApplication(testApp.app);

    await postEvent(application, startingIn(10));
    const inAnHour = scheduledEventSchema.parse(
      (await postEvent(application, startingIn(60))).body,
    );

    expect(await remindersOf(application.id)).toEqual([
      {
        type: 'interview_soon',
        status: 'pending',
        dueAt: minutesAfter(45),
        scheduledEventId: inAnHour.id,
      },
    ]);
  });

  it('POST without a duration or a place stores 60 minutes and no location', async () => {
    const application = await signUpWithApplication(testApp.app);

    const response = await postEvent(application, startingIn(300));

    expect(scheduledEventSchema.parse(response.body)).toMatchObject({
      durationMin: 60,
      locationOrLink: null,
    });
  });

  it('GET lists the events of the application earliest start first', async () => {
    const later = await olenaWithEvent();
    const earlier = scheduledEventSchema.parse((await postEvent(later, startingIn(300))).body);

    const response = await call(later.accessToken, eventRoutes(later).get);

    expect(response.status).toBe(200);
    const { items } = scheduledEventListResponseSchema.parse(response.body);
    expect(items.map(({ id, startsAt }) => ({ id, startsAt }))).toEqual([
      { id: earlier.id, startsAt: '2026-10-22T14:00:00.000Z' },
      { id: later.eventId, startsAt: STARTS_AT },
    ]);
  });

  it('PATCH to done after the event journals one interview_done at its end, closes the reminder and suggests final', async () => {
    const event = await eventAtTechInterview();
    clock.at(AFTER_THE_EVENT);

    const response = await patchEvent(event, DONE);

    expect(response.status).toBe(200);
    expect(scheduledEventUpdateResponseSchema.parse(response.body)).toMatchObject({
      status: 'done',
      outcomeNote: DONE.outcomeNote,
      updatedAt: AFTER_THE_EVENT.toISOString(),
      suggestedStage: 'final',
    });
    expect(await journalRowsOf(event.id)).toEqual([
      SCHEDULED_ROW,
      {
        kind: 'interview_done',
        payload: { kind: 'tech_interview', durationMin: 90 },
        occurredAt: new Date(ENDS_AT),
      },
    ]);
    expect(await remindersOf(event.id)).toMatchObject([{ status: 'done' }]);
  });

  it("GET timeline titles the completed event Техінтерв'ю пройдено · 90 хв", async () => {
    const event = await olenaWithEvent();
    clock.at(AFTER_THE_EVENT);
    await patchEvent(event, DONE);

    const response = await call(event.accessToken, { method: 'get', path: timelinePath(event.id) });

    const { items } = applicationTimelineResponseSchema.parse(response.body);
    expect(items.filter(({ type }) => type === 'interview_done')).toMatchObject([
      { title: "Техінтерв'ю пройдено · 90 хв", occurredAt: ENDS_AT },
    ]);
  });

  it('PATCH to done suggests no stage when the stage machine refuses final from applied', async () => {
    const event = await olenaWithEvent();

    const response = await patchEvent(event, DONE);

    expect(scheduledEventUpdateResponseSchema.parse(response.body).suggestedStage).toBeNull();
  });

  it('two overlapping PATCHes to done answer one 200 and one 409 and journal interview_done once', async () => {
    const event = await olenaWithEvent();

    const { both } = await testApp.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM scheduled_events WHERE id = ${event.eventId}::uuid FOR UPDATE`;
      const patches = Promise.all([patchEvent(event, DONE), patchEvent(event, DONE)]);
      await expect.poll(lockWaiters).toBe(2);
      return { both: patches };
    });

    const responses = await both;
    expect(responses.map(statusAndDetail).sort()).toEqual([[200, undefined], CHANGED_MEANWHILE]);
    expect(await journalRowsOf(event.id)).toMatchObject([
      { kind: 'interview_scheduled' },
      { kind: 'interview_done' },
    ]);
  });

  it('PATCH to done again on a done event answers 200 and journals nothing new', async () => {
    const event = await olenaWithEvent();
    await patchEvent(event, DONE);

    const response = await patchEvent(event, DONE);

    expect(response.status).toBe(200);
    expect(await journalRowsOf(event.id)).toHaveLength(2);
  });

  it.each([{ status: 'planned' }, { status: 'cancelled' }])(
    'PATCH of a done event to $status answers 409 and keeps it done',
    async (body) => {
      const event = await olenaWithEvent();
      await patchEvent(event, DONE);

      const response = await patchEvent(event, body);

      expect(statusAndDetail(response)).toEqual([
        409,
        `A done scheduled event cannot become ${body.status}`,
      ]);
      expect((await storedEvent(event.eventId)).status).toBe('done');
    },
  );

  it('PATCH of the start moves the reminder: the old one is dismissed and a new one waits', async () => {
    const event = await olenaWithEvent();

    const response = await patchEvent(event, { startsAt: '2026-10-24T10:00:00+03:00' });

    expect(scheduledEventSchema.parse(response.body).startsAt).toBe('2026-10-24T07:00:00.000Z');
    expect(await remindersOf(event.id)).toMatchObject([
      { status: 'dismissed', dueAt: new Date('2026-10-23T11:00:00.000Z') },
      { status: 'pending', dueAt: new Date('2026-10-24T05:00:00.000Z') },
    ]);
  });

  it('PATCH to cancelled dismisses the reminder and back to planned arms a new one', async () => {
    const event = await olenaWithEvent();

    await patchEvent(event, { status: 'cancelled' });
    const cancelled = await remindersOf(event.id);
    await patchEvent(event, { status: 'planned' });

    expect(cancelled).toMatchObject([{ status: 'dismissed' }]);
    expect((await remindersOf(event.id)).map(({ status }) => status).sort()).toEqual([
      'dismissed',
      'pending',
    ]);
  });

  it('DELETE answers 204 and removes the event with its reminder', async () => {
    const event = await olenaWithEvent();

    const response = await call(event.accessToken, eventRoutes(event).delete);

    expect([response.status, response.text]).toEqual([204, '']);
    const list = await call(event.accessToken, eventRoutes(event).get);
    expect(scheduledEventListResponseSchema.parse(list.body).items).toEqual([]);
    expect(await remindersOf(event.id)).toEqual([]);
  });

  it('GET ics answers 200 with a text/calendar attachment that ical.js reads back', async () => {
    const event = await olenaWithEvent();

    const response = await call(event.accessToken, eventRoutes(event).ics);

    expect([response.status, response.headers['content-type']]).toEqual([
      200,
      'text/calendar; charset=utf-8',
    ]);
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="jobflow-event.ics"',
    );
    expect(icsEventFieldsOf(response.text)).toEqual({
      uid: `${event.eventId}@jobflow-tracker`,
      summary: "Техінтерв'ю · Ромашка",
      location: TECH_INTERVIEW.locationOrLink,
      start: STARTS_AT,
      end: ENDS_AT,
    });
  });

  it('shows the planned event as the next scheduled event of the board card', async () => {
    const event = await olenaWithEvent();

    const board = await getApplicationBoard(testApp.app, { accessToken: event.accessToken });

    expect(board.columns.applied.items).toMatchObject([
      { id: event.id, nextScheduledEvent: { kind: 'tech_interview', startsAt: STARTS_AT } },
    ]);
  });

  it('answers every scheduled events route without a token with 401', async () => {
    const event = await olenaWithEvent();

    const responses = await Promise.all(
      Object.values(eventRoutes(event)).map((route) => callRoute(testApp.app, route)),
    );

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401, 401]);
  });

  it.each([
    { case: 'a start with no offset', body: { startsAt: '2026-10-23T16:00:00' }, path: 'startsAt' },
    { case: 'a duration under 5 minutes', body: { durationMin: 4 }, path: 'durationMin' },
    { case: 'a duration over 8 hours', body: { durationMin: 481 }, path: 'durationMin' },
    { case: 'an unknown kind', body: { kind: 'lunch' }, path: 'kind' },
    {
      case: 'a place over 500 characters',
      body: { locationOrLink: 'ж'.repeat(501) },
      path: 'locationOrLink',
    },
  ])('POST and PATCH answer $case with 422 at $path and keep the event', async ({ body, path }) => {
    const event = await olenaWithEvent();
    const before = await storedEvent(event.eventId);
    const routes = eventRoutes(event, body);

    const responses = await responsesOf(event.accessToken, [
      { ...routes.post, body: { ...TECH_INTERVIEW, ...body } },
      routes.patch,
    ]);

    expect(responses.map((response) => [response.status, errorPathsOf(response.body)])).toEqual([
      [422, [path]],
      [422, [path]],
    ]);
    expect(await storedEvent(event.eventId)).toEqual(before);
    expect(await testApp.prisma.scheduledEvent.count({ where: { applicationId: event.id } })).toBe(
      1,
    );
  });

  it.each([
    { case: 'an unknown status', body: { status: 'moved' }, path: 'status' },
    {
      case: 'an outcome note over 2000 characters',
      body: { outcomeNote: 'ж'.repeat(2001) },
      path: 'outcomeNote',
    },
  ])('PATCH answers $case with 422 at $path', async ({ body, path }) => {
    const event = await olenaWithEvent();

    const response = await patchEvent(event, body);

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, [path]]);
  });

  it('PATCH with no field and every event route with a malformed event id answer 422', async () => {
    const event = await olenaWithEvent();
    const { patch, delete: remove, ics } = eventRoutes({ ...event, eventId: 'not-a-uuid' });

    const responses = await responsesOf(event.accessToken, [
      eventRoutes(event, {}).patch,
      patch,
      remove,
      ics,
    ]);

    expect(
      responses.map(({ status, body }) => [status, errorResponseSchema.parse(body).type]),
    ).toEqual(Array.from({ length: 4 }, () => [422, 'validation_error']));
  });

  it.each(foreignReaches<SignedInEvent>(testApp, 'scheduled event'))(
    'PATCH, DELETE and GET ics answer $case with 404 and keep the event',
    async ({ reach }) => {
      const event = await olenaWithEvent();
      const before = await storedEvent(event.eventId);
      const target = await reach(event);
      const { patch, delete: remove, ics } = eventRoutes(target);

      const responses = await responsesOf(target.accessToken, [patch, remove, ics]);

      expect(responses.map(statusAndDetail)).toEqual([MISSING_EVENT, MISSING_EVENT, MISSING_EVENT]);
      expect(responses.map(({ headers }) => headers['content-disposition'])).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(await storedEvent(event.eventId)).toEqual(before);
    },
  );

  it('answers every scheduled events route on a soft-deleted application with 404 and keeps the event', async () => {
    const event = await olenaWithEvent();
    const before = await storedEvent(event.eventId);
    await call(event.accessToken, { method: 'delete', path: applicationPath(event.id) });

    const responses = await responsesOf(event.accessToken, Object.values(eventRoutes(event)));

    expect(responses.map(statusAndDetail)).toEqual([
      MISSING_APPLICATION,
      MISSING_APPLICATION,
      MISSING_EVENT,
      MISSING_EVENT,
      MISSING_EVENT,
    ]);
    expect(await storedEvent(event.eventId)).toEqual(before);
  });
});
