import { applicationResponseSchema, errorResponseSchema } from '@jobflow/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationEventRow,
  createApplication,
  CREATION_EVENT_ROW,
  listPages,
  postStageMove,
  ROMASHKA,
  stageEventsOf,
  stageEventsPath,
  undoLastMove,
} from '../../test/applications.js';
import { OLENA, signUp } from '../../test/auth.js';
import { seedRejectionReasons } from '../../test/factories.js';
import { callRoute, errorPathsOf, type RouteCall } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { MISSING_ID, TO_SCREENING } from '../../test/service-fixtures.js';
import {
  daysBefore,
  NOW,
  PAST_UNDO_WINDOW,
  settableClock,
  UNDO_WINDOW_END,
} from '../../test/time.js';

const clock = settableClock(NOW);

const TO_TECH_INTERVIEW = { fromStage: 'applied', toStage: 'tech_interview' };

const TO_REJECTED = { fromStage: 'applied', toStage: 'rejected', reasonCode: 'skills_gap' };

const MOVE_INSTANTS = [
  '2026-10-22T09:00:00.001Z',
  '2026-10-22T09:00:00.002Z',
  '2026-10-22T09:00:00.003Z',
];

describe('the stage move routes', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  beforeAll(() => seedRejectionReasons(testApp.prisma));

  beforeEach(() => {
    clock.at(NOW);
  });

  async function appliedAt(accessToken: string, createdAt: Date): Promise<string> {
    clock.at(createdAt);
    const application = await createApplication(testApp.app, { accessToken, input: ROMASHKA });
    clock.at(NOW);
    return application.id;
  }

  async function olenaWithApplication() {
    const olena = await signUp(testApp.app, OLENA);
    const id = await appliedAt(olena.accessToken, daysBefore(3));
    return { userId: olena.user.id, accessToken: olena.accessToken, id };
  }

  const compensationsOf = async (applicationId: string) =>
    (await stageEventsOf(testApp.prisma, applicationId)).filter(
      ({ compensatesEventId }) => compensatesEventId !== null,
    );

  const moveEventIdOf = async (applicationId: string) => {
    const move = await testApp.prisma.stageEvent.findFirstOrThrow({
      where: { applicationId, fromStage: 'applied' },
      select: { id: true },
    });
    return move.id;
  };

  const storedStage = (id: string) =>
    testApp.prisma.application.findUniqueOrThrow({
      where: { id },
      select: { currentStage: true, lastEventAt: true },
    });

  const stageChangedRows = () =>
    outboxRows(testApp.prisma, { eventType: 'application.stage_changed' });

  const detailOf = (body: unknown) => errorResponseSchema.parse(body).detail;

  it('moves applied to screening and commits the stage event, the projection and application.stage_changed together', async () => {
    const { userId, accessToken, id } = await olenaWithApplication();

    const response = await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });

    expect(response.status).toBe(201);
    expect(applicationResponseSchema.parse(response.body)).toMatchObject({
      id,
      currentStage: 'screening',
      lastEventAt: '2026-10-22T09:00:00.000Z',
      daysInStage: 0,
      daysSinceLastEvent: 0,
    });
    expect(await stageEventsOf(testApp.prisma, id)).toEqual([
      { ...CREATION_EVENT_ROW, occurredAt: daysBefore(3) },
      {
        fromStage: 'applied',
        toStage: 'screening',
        reasonCode: null,
        occurredAt: NOW,
        compensatesEventId: null,
      },
    ]);
    expect(await storedStage(id)).toEqual({ currentStage: 'screening', lastEventAt: NOW });
    expect(await stageChangedRows()).toEqual([
      applicationEventRow({
        eventType: 'application.stage_changed',
        userId,
        applicationId: id,
        fromStage: 'applied',
        toStage: 'screening',
        reasonCode: null,
        compensatesEventId: null,
      }),
    ]);
  });

  it.each([
    { case: 'applied to tech_interview twice', inputs: [TO_TECH_INTERVIEW, TO_TECH_INTERVIEW] },
    {
      case: 'applied to screening against applied to rejected',
      inputs: [TO_SCREENING, TO_REJECTED],
    },
  ])(
    'lets one of two simultaneous moves win and answers the other with 409 for $case',
    async ({ inputs }) => {
      const { accessToken, id } = await olenaWithApplication();

      const responses = await Promise.all(
        inputs.map((input) => postStageMove(testApp.app, { accessToken, id, input })),
      );

      const statuses = responses.map(({ status }) => status);
      expect(statuses.sort((left, right) => left - right)).toEqual([201, 409]);
      const winner = responses.find(({ status }) => status === 201);
      const loser = responses.find(({ status }) => status === 409);
      expect(errorResponseSchema.parse(loser?.body).type).toBe('conflict');
      const { currentStage } = applicationResponseSchema.parse(winner?.body);
      expect((await storedStage(id)).currentStage).toBe(currentStage);
      expect(await stageEventsOf(testApp.prisma, id)).toHaveLength(2);
      expect(await stageChangedRows()).toHaveLength(1);
    },
  );

  it('undoes a move 10 000 ms after it back to applied with its old lastEventAt and exactly one compensating row', async () => {
    const { userId, accessToken, id } = await olenaWithApplication();
    await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });
    const moveId = await moveEventIdOf(id);
    clock.at(UNDO_WINDOW_END);

    const response = await undoLastMove(testApp.app, { accessToken, id });

    expect(response.status).toBe(201);
    const undone = {
      currentStage: 'applied',
      lastEventAt: '2026-10-19T09:00:00.000Z',
      daysInStage: 3,
      daysSinceLastEvent: 3,
    };
    expect(applicationResponseSchema.parse(response.body)).toMatchObject(undone);
    const [listed] = (await listPages(testApp.app, { accessToken })).flatMap(({ items }) => items);
    expect(listed).toMatchObject(undone);
    expect(await compensationsOf(id)).toEqual([
      {
        fromStage: 'screening',
        toStage: 'applied',
        reasonCode: null,
        occurredAt: UNDO_WINDOW_END,
        compensatesEventId: moveId,
      },
    ]);
    expect((await stageChangedRows()).at(-1)).toEqual(
      applicationEventRow({
        eventType: 'application.stage_changed',
        userId,
        applicationId: id,
        fromStage: 'screening',
        toStage: 'applied',
        reasonCode: null,
        compensatesEventId: moveId,
      }),
    );
    const again = await undoLastMove(testApp.app, { accessToken, id });
    expect([again.status, detailOf(again.body)]).toEqual([409, 'Nothing to undo']);
    expect(await compensationsOf(id)).toHaveLength(1);
  });

  it('refuses an undo 10 001 ms after the move with 409 and keeps the application in screening', async () => {
    const { accessToken, id } = await olenaWithApplication();
    await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });
    clock.at(PAST_UNDO_WINDOW);

    const response = await undoLastMove(testApp.app, { accessToken, id });

    expect([response.status, detailOf(response.body)]).toEqual([409, 'The undo window has passed']);
    expect((await storedStage(id)).currentStage).toBe('screening');
    expect(await compensationsOf(id)).toEqual([]);
  });

  it('sets lastEventAt from the clock in milliseconds, so the list pages across moved applications', async () => {
    const { accessToken } = await signUp(testApp.app, OLENA);
    const moved: { id: string; lastEventAt: string }[] = [];
    for (const lastEventAt of MOVE_INSTANTS) {
      const id = await appliedAt(accessToken, daysBefore(3));
      clock.at(new Date(lastEventAt));
      await postStageMove(testApp.app, { accessToken, id, input: TO_SCREENING });
      moved.push({ id, lastEventAt });
    }

    const pages = await listPages(testApp.app, { accessToken, query: { limit: '1' } });

    expect(pages.map(({ items }) => items.length)).toEqual([1, 1, 1]);
    expect(
      pages.flatMap(({ items }) => items).map(({ id, lastEventAt }) => ({ id, lastEventAt })),
    ).toEqual([...moved].reverse());
  });

  it.each([
    {
      case: 'a move to rejected without a reason code while askRejectionReason is on',
      input: { fromStage: 'applied', toStage: 'rejected' },
      path: 'reasonCode',
    },
    {
      case: 'a reason code on screening',
      input: { ...TO_SCREENING, reasonCode: 'skills_gap' },
      path: 'reasonCode',
    },
    {
      case: 'an occurredAt 1 ms in the future',
      input: { ...TO_SCREENING, occurredAt: '2026-10-22T09:00:00.001Z' },
      path: 'occurredAt',
    },
    {
      case: 'an occurredAt before the previous event',
      input: { ...TO_SCREENING, occurredAt: '2026-10-19T08:59:59.999Z' },
      path: 'occurredAt',
    },
    {
      case: 'a comment with a NUL character',
      input: { ...TO_SCREENING, comment: 'Рекрутер\u0000ка' },
      path: 'comment',
    },
    {
      case: 'a comment of 1001 characters',
      input: { ...TO_SCREENING, comment: 'я'.repeat(1001) },
      path: 'comment',
    },
    {
      case: 'an unknown toStage',
      input: { fromStage: 'applied', toStage: 'hired' },
      path: 'toStage',
    },
    { case: 'a missing fromStage', input: { toStage: 'screening' }, path: 'fromStage' },
  ])('answers $case with 422 on $path and writes nothing', async ({ input, path }) => {
    const { accessToken, id } = await olenaWithApplication();

    const response = await postStageMove(testApp.app, { accessToken, id, input });

    expect(response.status).toBe(422);
    expect(errorPathsOf(response.body)).toContain(path);
    expect(await stageEventsOf(testApp.prisma, id)).toHaveLength(1);
    expect(await stageChangedRows()).toEqual([]);
  });

  it.each([
    {
      case: 'askRejectionReason is off and no code is sent',
      ask: false,
      input: { fromStage: 'applied', toStage: 'rejected' },
    },
    {
      case: 'unspecified is sent while askRejectionReason is on',
      ask: true,
      input: { fromStage: 'applied', toStage: 'rejected', reasonCode: 'unspecified' },
    },
  ])('records unspecified on a move to rejected when $case', async ({ ask, input }) => {
    const { userId, accessToken, id } = await olenaWithApplication();
    await testApp.prisma.userSettings.update({
      where: { userId },
      data: { askRejectionReason: ask },
    });

    const response = await postStageMove(testApp.app, { accessToken, id, input });

    expect(response.status).toBe(201);
    expect((await stageEventsOf(testApp.prisma, id)).at(-1)).toMatchObject({
      toStage: 'rejected',
      reasonCode: 'unspecified',
    });
  });

  it('keeps a backdated occurredAt as the event time and counts the days from it', async () => {
    const { accessToken, id } = await olenaWithApplication();

    const response = await postStageMove(testApp.app, {
      accessToken,
      id,
      input: { ...TO_SCREENING, occurredAt: '2026-10-21T09:00:00.000Z' },
    });

    expect(response.status).toBe(201);
    expect(applicationResponseSchema.parse(response.body)).toMatchObject({
      currentStage: 'screening',
      lastEventAt: '2026-10-21T09:00:00.000Z',
      daysInStage: 1,
      daysSinceLastEvent: 1,
    });
    expect((await stageEventsOf(testApp.prisma, id)).at(-1)).toMatchObject({
      occurredAt: daysBefore(1),
    });
  });

  it.each([
    {
      case: 'a stale fromStage with 409 conflict',
      input: TO_SCREENING,
      error: { type: 'conflict', detail: 'The application is in rejected, not applied' },
    },
    {
      case: 'a move out of rejected with 409 illegal_transition',
      input: { fromStage: 'rejected', toStage: 'screening' },
      error: { type: 'illegal_transition', detail: 'rejected -> screening: terminal_stage' },
    },
  ])('answers $case on a rejected application and writes nothing', async ({ input, error }) => {
    const { accessToken, id } = await olenaWithApplication();
    await postStageMove(testApp.app, { accessToken, id, input: TO_REJECTED });
    const eventsBefore = await stageEventsOf(testApp.prisma, id);

    const response = await postStageMove(testApp.app, { accessToken, id, input });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject(error);
    expect(await stageEventsOf(testApp.prisma, id)).toEqual(eventsBefore);
  });

  it.each([
    { route: 'POST events', body: TO_SCREENING, suffix: '' },
    { route: 'POST events/undo-last', body: undefined, suffix: '/undo-last' },
  ])(
    'answers $route without a token with 401 and for a missing id with 404',
    async ({ body, suffix }) => {
      const { accessToken } = await signUp(testApp.app, OLENA);
      const route: RouteCall = {
        method: 'post',
        path: `${stageEventsPath(MISSING_ID)}${suffix}`,
        body,
      };

      const anonymous = await callRoute(testApp.app, route);
      const missing = await callRoute(testApp.app, { ...route, accessToken });

      expect([anonymous.status, errorResponseSchema.parse(anonymous.body).type]).toEqual([
        401,
        'unauthorized',
      ]);
      expect([missing.status, detailOf(missing.body)]).toEqual([404, 'Application not found']);
    },
  );
});
