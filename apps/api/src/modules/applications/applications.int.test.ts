import { applicationResponseSchema, errorResponseSchema, STAGE_CHANGE_HINT } from '@jobflow/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationEventRow,
  applicationPath,
  APPLICATIONS_PATH,
  createApplication,
  CREATION_EVENT_ROW,
  postApplication,
  ROMASHKA,
  stageEventsOf,
} from '../../test/applications.js';
import { accessTokenFor, BOHDAN, OLENA, signUp } from '../../test/auth.js';
import { createResumeVersion, createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf, type RouteCall } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { MISSING_ID } from '../../test/service-fixtures.js';
import { daysAfter, NOW, settableClock } from '../../test/time.js';

const START_ISO = '2026-10-22T09:00:00.000Z';

const ID_ROUTES: Omit<RouteCall, 'path'>[] = [
  { method: 'get' },
  { method: 'patch', body: { company: 'Нова назва' } },
  { method: 'delete' },
];

const clock = settableClock(NOW);

const travelDays = (days: number) => {
  clock.at(daysAfter(days));
};

describe('the applications routes', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  beforeEach(() => {
    clock.at(NOW);
  });

  async function signedUpWithApplication() {
    const olena = await signUp(testApp.app, OLENA);
    const application = await createApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: ROMASHKA,
    });
    return { olena, application };
  }

  async function activeSearchId(userId: string): Promise<string> {
    const search = await testApp.prisma.search.findFirstOrThrow({
      where: { userId, status: 'active' },
    });
    return search.id;
  }

  async function activateResumeVersion(userId: string): Promise<string> {
    const activeResumeVersionId = await createResumeVersion(testApp.prisma, userId);
    await testApp.prisma.userSettings.update({
      where: { userId },
      data: { activeResumeVersionId },
    });
    return activeResumeVersionId;
  }

  const updatedEvents = () => outboxRows(testApp.prisma, { eventType: 'application.updated' });

  it('POST creates an application from company and position alone in applied with one stage event and the created event', async () => {
    const olena = await signUp(testApp.app, OLENA);

    const response = await postApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: ROMASHKA,
    });

    expect(response.status).toBe(201);
    const application = applicationResponseSchema.parse(response.body);
    expect(response.body).toEqual(application);
    expect(application).toMatchObject({
      searchId: await activeSearchId(olena.user.id),
      company: 'Ромашка',
      position: 'Backend developer',
      url: null,
      source: 'other',
      stack: [],
      currentStage: 'applied',
      isDraft: false,
      resumeVersionId: null,
      appliedAt: START_ISO,
      lastEventAt: START_ISO,
      daysInStage: 0,
      daysSinceLastEvent: 0,
      silenceLevel: 'none',
    });
    expect(await stageEventsOf(testApp.prisma, application.id)).toEqual([CREATION_EVENT_ROW]);
    expect(await outboxRows(testApp.prisma, { aggregate: 'application' })).toEqual([
      applicationEventRow({
        eventType: 'application.created',
        userId: olena.user.id,
        applicationId: application.id,
      }),
    ]);
  });

  it("POST attaches the owner's active resume version and search while another user has their own", async () => {
    const bohdan = await signUp(testApp.app, BOHDAN);
    await activateResumeVersion(bohdan.user.id);
    const olena = await signUp(testApp.app, OLENA);
    const resumeVersionId = await activateResumeVersion(olena.user.id);

    const application = await createApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: ROMASHKA,
    });

    expect(application).toMatchObject({
      resumeVersionId,
      searchId: await activeSearchId(olena.user.id),
    });
  });

  it('POST answers 409 for a user without an active search and writes nothing', async () => {
    const user = await createUser(testApp.prisma);

    const response = await postApplication(testApp.app, {
      accessToken: await accessTokenFor(user),
      input: ROMASHKA,
    });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      type: 'conflict',
      detail: 'No active search',
    });
    expect(await testApp.prisma.application.count()).toBe(0);
  });

  it.each([
    {
      case: 'salaryMin above salaryMax',
      body: { salaryMin: 5900, salaryMax: 4700 },
      path: 'salaryMin',
    },
    {
      case: 'a salaryMin past the 32-bit integer column',
      body: { salaryMin: 2147483648, salaryMax: 2147483649 },
      path: 'salaryMin',
    },
    { case: 'a lowercase currency', body: { currency: 'usd' }, path: 'currency' },
    { case: 'an unknown currency', body: { currency: 'XYZ' }, path: 'currency' },
    { case: 'a javascript: url', body: { url: 'javascript:alert(1)' }, path: 'url' },
    { case: 'a url that is not a url', body: { url: 'not-a-url' }, path: 'url' },
    {
      case: '21 stack items',
      body: { stack: Array.from({ length: 21 }, (_, index) => `tech-${String(index)}`) },
      path: 'stack',
    },
    { case: 'a missing company', body: { company: undefined }, path: 'company' },
    { case: 'a missing position', body: { position: undefined }, path: 'position' },
  ])('POST answers $case with 422 on $path and writes nothing', async ({ body, path }) => {
    const olena = await signUp(testApp.app, OLENA);

    const response = await postApplication(testApp.app, {
      accessToken: olena.accessToken,
      input: { ...ROMASHKA, ...body },
    });

    expect(response.status).toBe(422);
    expect(errorPathsOf(response.body)).toContain(path);
    expect(await testApp.prisma.application.count()).toBe(0);
  });

  it.each<RouteCall>([
    { method: 'post', path: APPLICATIONS_PATH, body: ROMASHKA },
    { method: 'get', path: applicationPath(MISSING_ID) },
    { method: 'patch', path: applicationPath(MISSING_ID), body: { company: 'Нова назва' } },
    { method: 'delete', path: applicationPath(MISSING_ID) },
  ])('answers $method $path without a token with 401', async (route) => {
    const response = await callRoute(testApp.app, route);

    expect(response.status).toBe(401);
    expect(errorResponseSchema.parse(response.body).type).toBe('unauthorized');
  });

  it.each([
    { days: 8, silenceLevel: 'silent' },
    { days: 4, silenceLevel: 'warn' },
    { days: 3, silenceLevel: 'none' },
  ])(
    'GET after $days days counts $days days in stage and since the last event as $silenceLevel',
    async ({ days, silenceLevel }) => {
      const { olena, application } = await signedUpWithApplication();
      travelDays(days);

      const response = await callRoute(testApp.app, {
        method: 'get',
        path: applicationPath(application.id),
        accessToken: olena.accessToken,
      });

      expect(response.status).toBe(200);
      expect(applicationResponseSchema.parse(response.body)).toMatchObject({
        daysInStage: days,
        daysSinceLastEvent: days,
        silenceLevel,
      });
    },
  );

  it('PATCH changes company and the salary pair, keeps lastEventAt and records application.updated with those fields', async () => {
    const { olena, application } = await signedUpWithApplication();
    travelDays(2);

    const response = await callRoute(testApp.app, {
      method: 'patch',
      path: applicationPath(application.id),
      body: { company: 'Ромашка Плюс', salaryMin: 4700, salaryMax: 5900 },
      accessToken: olena.accessToken,
    });

    expect(response.status).toBe(200);
    expect(applicationResponseSchema.parse(response.body)).toMatchObject({
      company: 'Ромашка Плюс',
      position: 'Backend developer',
      salaryMin: 4700,
      salaryMax: 5900,
      currentStage: 'applied',
      lastEventAt: START_ISO,
      daysSinceLastEvent: 2,
    });
    expect(await updatedEvents()).toEqual([
      applicationEventRow({
        eventType: 'application.updated',
        userId: olena.user.id,
        applicationId: application.id,
        fields: ['company', 'salaryMin', 'salaryMax'],
      }),
    ]);
  });

  it.each([
    {
      case: 'a lone salaryMin',
      body: { salaryMin: 4700 },
      error: { path: 'salaryMin', message: 'Send salaryMin and salaryMax together' },
    },
    {
      case: 'an empty body',
      body: {},
      error: { path: '', message: 'Send at least one field to change' },
    },
    {
      case: 'a stage change alone',
      body: { currentStage: 'screening' },
      error: { path: 'currentStage', message: STAGE_CHANGE_HINT },
    },
    {
      case: 'a stage change next to another field',
      body: { currentStage: 'screening', company: 'Нова назва' },
      error: { path: 'currentStage', message: STAGE_CHANGE_HINT },
    },
  ])(
    'PATCH answers $case with 422 on "$error.path", keeps the stage and records no change',
    async ({ body, error }) => {
      const { olena, application } = await signedUpWithApplication();

      const response = await callRoute(testApp.app, {
        method: 'patch',
        path: applicationPath(application.id),
        body,
        accessToken: olena.accessToken,
      });

      expect(response.status).toBe(422);
      expect(errorResponseSchema.parse(response.body).errors).toContainEqual(error);
      const stored = await testApp.prisma.application.findUniqueOrThrow({
        where: { id: application.id },
        select: { currentStage: true, company: true },
      });
      expect(stored).toEqual({ currentStage: 'applied', company: 'Ромашка' });
      expect(await stageEventsOf(testApp.prisma, application.id)).toHaveLength(1);
      expect(await updatedEvents()).toEqual([]);
    },
  );

  it('DELETE soft deletes at the clock time, keeps the stage events and records deletedAt', async () => {
    const { olena, application } = await signedUpWithApplication();
    travelDays(1);

    const response = await callRoute(testApp.app, {
      method: 'delete',
      path: applicationPath(application.id),
      accessToken: olena.accessToken,
    });

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const stored = await testApp.prisma.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { deletedAt: true },
    });
    expect(stored.deletedAt).toEqual(new Date('2026-10-23T09:00:00.000Z'));
    expect(await stageEventsOf(testApp.prisma, application.id)).toEqual([CREATION_EVENT_ROW]);
    expect(await updatedEvents()).toEqual([
      applicationEventRow({
        eventType: 'application.updated',
        userId: olena.user.id,
        applicationId: application.id,
        fields: ['deletedAt'],
      }),
    ]);
  });

  it.each(ID_ROUTES)(
    '$method answers a deleted and a missing application with 404',
    async (route) => {
      const { olena, application } = await signedUpWithApplication();
      const { accessToken } = olena;
      await callRoute(testApp.app, {
        method: 'delete',
        path: applicationPath(application.id),
        accessToken,
      });

      const answers = await Promise.all(
        [application.id, MISSING_ID].map((id) =>
          callRoute(testApp.app, { ...route, path: applicationPath(id), accessToken }),
        ),
      );

      expect(
        answers.map((answer) => [answer.status, errorResponseSchema.parse(answer.body).detail]),
      ).toEqual([
        [404, 'Application not found'],
        [404, 'Application not found'],
      ]);
    },
  );

  it.each(ID_ROUTES)('$method answers a malformed id with 422', async (route) => {
    const { accessToken } = await signUp(testApp.app, OLENA);

    const response = await callRoute(testApp.app, {
      ...route,
      path: applicationPath('not-a-uuid'),
      accessToken,
    });

    expect(response.status).toBe(422);
    expect(errorResponseSchema.parse(response.body).type).toBe('validation_error');
  });
});
