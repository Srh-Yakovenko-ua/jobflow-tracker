import { reminderListResponseSchema, reminderSchema, type Stage } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { useStageMoveTestApp } from '../../test/applications.js';
import { createReminder, createScheduledEvent, type NewReminder } from '../../test/factories.js';
import { callRoute, errorPathsOf, statusAndType } from '../../test/http.js';
import { ownedStageApplication, type StageApplicationOwner } from '../../test/reminders.js';
import { REMINDER_ID } from '../../test/service-fixtures.js';
import { daysAfter, daysBefore, minutesAfter, NOW, settableClock } from '../../test/time.js';
import { RemindersService } from './reminders.service.js';

type ReminderFields = Omit<NewReminder, 'userId' | 'applicationId'>;

type PostRoute = { path: string; body?: object };

const REMINDERS_PATH = '/api/v1/reminders';

const reminderPath = (id: string, action: string) => `${REMINDERS_PATH}/${id}/${action}`;

const clock = settableClock(NOW);

describe('the reminders API', () => {
  const testApp = useStageMoveTestApp(clock);

  const owner = (stage: Stage = 'applied') =>
    ownedStageApplication(testApp.prisma, { stage, lastEventAt: daysBefore(8) });

  const reminderOf = ({ userId, applicationId }: StageApplicationOwner, fields: ReminderFields) =>
    createReminder(testApp.prisma, { userId, applicationId, ...fields });

  async function listOf(accessToken: string) {
    const response = await callRoute(testApp.app, {
      method: 'get',
      path: REMINDERS_PATH,
      accessToken,
    });
    expect(response.status).toBe(200);
    return reminderListResponseSchema.parse(response.body).items;
  }

  const post = (accessToken: string, route: PostRoute) =>
    callRoute(testApp.app, { method: 'post', accessToken, ...route });

  it('lists the pending and snoozed reminders of open applications, earliest due first', async () => {
    const olena = await owner();
    const scheduledEventId = await createScheduledEvent(testApp.prisma, {
      applicationId: olena.applicationId,
      kind: 'tech_interview',
      startsAt: daysAfter(1),
    });
    const interview = await reminderOf(olena, {
      type: 'interview_soon',
      scheduledEventId,
      dueAt: minutesAfter(60),
    });
    const followup = await reminderOf(olena, {
      status: 'snoozed',
      dueAt: daysBefore(1),
      snoozedUntil: daysAfter(2),
    });
    await reminderOf(olena, { status: 'done', dueAt: daysBefore(3) });
    await reminderOf(await owner('rejected'), { dueAt: daysBefore(2) });

    expect(await listOf(olena.accessToken)).toEqual([
      {
        id: followup,
        applicationId: olena.applicationId,
        company: 'Acme',
        stage: 'applied',
        type: 'followup',
        status: 'snoozed',
        scheduledEventId: null,
        dueAt: daysBefore(1).toISOString(),
        snoozedUntil: daysAfter(2).toISOString(),
      },
      expect.objectContaining({ id: interview, type: 'interview_soon', scheduledEventId }),
    ]);
  });

  it("hides another user's reminders and a rejected application's", async () => {
    const olena = await owner();
    const rejected = await owner('rejected');
    await reminderOf(olena, { dueAt: NOW });
    await reminderOf(rejected, { dueAt: NOW });

    expect(await listOf(rejected.accessToken)).toEqual([]);
  });

  it.each([
    { action: 'done', status: 'done' },
    { action: 'dismiss', status: 'dismissed' },
  ])(
    'answers 200 to $action, stores $status and drops the reminder from the list',
    async ({ action, status }) => {
      const olena = await owner();
      const id = await reminderOf(olena, { dueAt: NOW });

      const response = await post(olena.accessToken, { path: reminderPath(id, action) });

      expect(response.status).toBe(200);
      expect(reminderSchema.parse(response.body)).toMatchObject({ id, status, snoozedUntil: null });
      expect(await listOf(olena.accessToken)).toEqual([]);
    },
  );

  it('snoozes a reminder until now plus the days, and again while snoozed', async () => {
    const olena = await owner();
    const id = await reminderOf(olena, { dueAt: NOW });

    expect(
      (await post(olena.accessToken, { path: reminderPath(id, 'snooze'), body: { days: 30 } }))
        .status,
    ).toBe(200);
    const response = await post(olena.accessToken, {
      path: reminderPath(id, 'snooze'),
      body: { days: 3 },
    });

    expect([response.status, response.body]).toEqual([
      200,
      expect.objectContaining({ status: 'snoozed', snoozedUntil: daysAfter(3).toISOString() }),
    ]);
  });

  it.each(['done', 'dismiss', 'snooze'])(
    "answers 404 to %s on another user's reminder and leaves it pending",
    async (action) => {
      const olena = await owner();
      const bohdan = await owner();
      const id = await reminderOf(olena, { dueAt: NOW });

      const response = await post(bohdan.accessToken, {
        path: reminderPath(id, action),
        body: { days: 1 },
      });

      expect(statusAndType(response)).toEqual([404, 'not_found']);
      expect((await listOf(olena.accessToken)).map(({ status }) => status)).toEqual(['pending']);
    },
  );

  it('answers 409 to a reminder that is already done', async () => {
    const olena = await owner();
    const id = await reminderOf(olena, { status: 'done', dueAt: NOW });

    const response = await post(olena.accessToken, {
      path: reminderPath(id, 'snooze'),
      body: { days: 1 },
    });

    expect(statusAndType(response)).toEqual([409, 'conflict']);
  });

  it.each([0, 31])('answers 422 at days to a snooze of %i days', async (days) => {
    const olena = await owner();
    const id = await reminderOf(olena, { dueAt: NOW });

    const response = await post(olena.accessToken, {
      path: reminderPath(id, 'snooze'),
      body: { days },
    });

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['days']]);
  });

  it.each([
    { method: 'get', path: REMINDERS_PATH },
    { method: 'post', path: reminderPath(REMINDER_ID, 'done') },
  ] as const)('answers 401 to $method $path without a token', async ({ method, path }) => {
    expect((await callRoute(testApp.app, { method, path })).status).toBe(401);
  });

  it("closes the application's follow-up as done when it is resolved and keeps it out of the list", async () => {
    const olena = await owner();
    await reminderOf(olena, { dueAt: NOW });

    await testApp.app
      .get(RemindersService)
      .resolveFollowups(olena.userId, { applicationId: olena.applicationId });

    expect(await listOf(olena.accessToken)).toEqual([]);
    expect(await testApp.prisma.reminder.findMany({ select: { status: true } })).toEqual([
      { status: 'done' },
    ]);
  });
});
