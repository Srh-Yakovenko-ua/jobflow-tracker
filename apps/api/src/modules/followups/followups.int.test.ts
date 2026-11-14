import { captureRetryResponseSchema, followupResponseSchema } from '@jobflow/shared';
import { buildFollowupInput, buildFollowupOutput } from '@jobflow/shared/testing';
import { describe, expect, it, vi } from 'vitest';

import { Clock } from '../../common/clock.js';
import { rateLimitedTestingModule, useTestApp } from '../../test/app.js';
import { contactsPath } from '../../test/applications.js';
import {
  createAiJob,
  createAiResult,
  createReminder,
  createScheduledEvent,
} from '../../test/factories.js';
import { type FollowupApplication, followupOwner, followupPath } from '../../test/followup.js';
import { callRoute, statusAndType } from '../../test/http.js';
import { keyHeaders } from '../../test/idempotency.js';
import { outboxRows } from '../../test/outbox.js';
import { expectHourlyAiLimit } from '../../test/rate-limit.js';
import type { StageApplicationOwner } from '../../test/reminders.js';
import { daysAfter, daysBefore, NOW, settableClock } from '../../test/time.js';

vi.hoisted(() => {
  vi.stubEnv('RATE_LIMIT_AI_PER_HOUR', '2');
});

const WARM = { tone: 'warm', language: 'uk' };

const FOLLOWUP_ROUTES = [
  { method: 'get', suffix: '' },
  { method: 'post', suffix: '' },
  { method: 'post', suffix: '/sent' },
] as const;

const clock = settableClock(NOW);

describe('the follow-up API', () => {
  const testApp = useTestApp(() =>
    rateLimitedTestingModule().overrideProvider(Clock).useValue(clock),
  );

  const owner = (application: FollowupApplication = {}) =>
    followupOwner(testApp.prisma, application);

  const generate = ({ accessToken, applicationId }: StageApplicationOwner, body: object = WARM) =>
    callRoute(testApp.app, {
      method: 'post',
      path: followupPath(applicationId),
      accessToken,
      body,
    });

  const markSent = ({ accessToken, applicationId }: StageApplicationOwner, key: string) =>
    callRoute(testApp.app, {
      method: 'post',
      path: `${followupPath(applicationId)}/sent`,
      accessToken,
      headers: keyHeaders(key),
    });

  async function withContactsAndInterviews(olena: StageApplicationOwner) {
    for (const name of ['Оксана Петренко', 'Ігор Коваль']) {
      const response = await callRoute(testApp.app, {
        method: 'post',
        path: contactsPath(olena.applicationId),
        accessToken: olena.accessToken,
        body: { name },
      });
      expect(response.status).toBe(201);
    }
    const interviews = [
      { kind: 'tech_interview', startsAt: daysBefore(7), status: 'done' },
      { kind: 'final_interview', startsAt: daysBefore(2), status: 'cancelled' },
      { kind: 'final_interview', startsAt: daysAfter(2), status: 'planned' },
    ] as const;
    for (const interview of interviews) {
      await createScheduledEvent(testApp.prisma, {
        applicationId: olena.applicationId,
        ...interview,
      });
    }
  }

  it('answers 202 with a queued followup job and writes the request event with the built input', async () => {
    const olena = await owner();
    await withContactsAndInterviews(olena);
    const { displayName } = await testApp.prisma.user.findUniqueOrThrow({
      where: { id: olena.userId },
      select: { displayName: true },
    });

    const response = await generate(olena, { ...WARM, hint: '  ', variant: true });

    expect(response.status).toBe(202);
    const { jobId } = captureRetryResponseSchema.parse(response.body);
    expect(
      await outboxRows(testApp.prisma, { eventType: 'application.followup_requested' }),
    ).toEqual([
      {
        aggregate: 'application',
        aggregateId: olena.applicationId,
        eventType: 'application.followup_requested',
        payload: {
          userId: olena.userId,
          applicationId: olena.applicationId,
          aiJobId: jobId,
          requestId: response.get('x-request-id'),
          fresh: true,
          input: buildFollowupInput({
            lastInterview: { kind: 'tech_interview', date: '2026-10-15' },
            senderName: displayName,
            hint: null,
          }),
        },
      },
    ]);
  });

  it('answers the running job to a second request and writes one event', async () => {
    const olena = await owner();

    const first = await generate(olena);
    const second = await generate(olena);

    expect(second.body).toEqual(first.body);
    expect(
      await outboxRows(testApp.prisma, { eventType: 'application.followup_requested' }),
    ).toHaveLength(1);
  });

  it.each([
    { case: 'a draft', stage: 'applied', isDraft: true },
    { case: 'a rejected application', stage: 'rejected', isDraft: false },
  ] as const)(
    'answers 409 to a request for $case and stores no job',
    async ({ stage, isDraft }) => {
      const olena = await owner({ stage, isDraft });

      expect(statusAndType(await generate(olena))).toEqual([409, 'conflict']);
      expect(await testApp.prisma.aiJob.count()).toBe(0);
    },
  );

  it.each([
    { case: 'an unknown tone', body: { tone: 'angry', language: 'uk' }, path: 'tone' },
    { case: 'a 301 character hint', body: { ...WARM, hint: 'я'.repeat(301) }, path: 'hint' },
  ])('answers 422 at $path to $case', async ({ body, path }) => {
    const response = await generate(await owner(), body);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ errors: [expect.objectContaining({ path })] });
  });

  it('answers 422 at company to a stored company the follow-up input refuses, and queues no job', async () => {
    const olena = await owner();
    await testApp.prisma.application.update({
      where: { id: olena.applicationId },
      data: { company: '' },
    });

    const response = await generate(olena);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ errors: [expect.objectContaining({ path: 'company' })] });
    expect(await testApp.prisma.aiJob.count()).toBe(0);
    expect(
      await outboxRows(testApp.prisma, { eventType: 'application.followup_requested' }),
    ).toEqual([]);
  });

  it.each(FOLLOWUP_ROUTES)(
    "answers 404 to $method followup$suffix on another user's application and stores nothing",
    async ({ method, suffix }) => {
      const olena = await owner();
      const bohdan = await owner();

      const response = await callRoute(testApp.app, {
        method,
        path: `${followupPath(olena.applicationId)}${suffix}`,
        accessToken: bohdan.accessToken,
        headers: keyHeaders('foreign'),
        body: WARM,
      });

      expect(statusAndType(response)).toEqual([404, 'not_found']);
      expect(await testApp.prisma.aiJob.count()).toBe(0);
      expect(await testApp.prisma.timelineEvent.count({ where: { kind: 'followup_sent' } })).toBe(
        0,
      );
    },
  );

  it('answers 429 to the third request of one user in an hour, and not to another user', async () => {
    const olena = await owner();
    const bohdan = await owner();

    await expectHourlyAiLimit({ caller: olena, send: generate });
    expect((await generate(bohdan)).status).toBe(202);
  });

  it('answers the latest done draft, the latest job, the guessed language and the silence days', async () => {
    const olena = await owner();
    const aiResultId = await createAiResult(testApp.prisma, {
      userId: olena.userId,
      kind: 'followup',
      output: buildFollowupOutput(),
    });
    const target = { userId: olena.userId, applicationId: olena.applicationId, kind: 'followup' };
    await createAiJob(testApp.prisma, {
      ...target,
      status: 'done',
      aiResultId,
      finishedAt: daysBefore(1),
    });
    const failedId = await createAiJob(testApp.prisma, {
      ...target,
      status: 'failed',
      errorType: 'ai_timeout',
    });

    const response = await callRoute(testApp.app, {
      method: 'get',
      path: followupPath(olena.applicationId),
      accessToken: olena.accessToken,
    });

    expect(response.status).toBe(200);
    expect(followupResponseSchema.parse(response.body)).toEqual({
      draft: { ...buildFollowupOutput(), generatedAt: daysBefore(1).toISOString() },
      job: { id: failedId, status: 'failed', errorType: 'ai_timeout' },
      language: 'uk',
      silenceDays: 6,
    });
  });

  it('records followup_sent once per key and closes the active follow-up reminder as done', async () => {
    const olena = await owner();
    await createReminder(testApp.prisma, {
      userId: olena.userId,
      applicationId: olena.applicationId,
      dueAt: NOW,
    });

    expect((await markSent(olena, 'sent-1')).status).toBe(204);
    expect((await markSent(olena, 'sent-1')).status).toBe(204);

    expect(
      await testApp.prisma.timelineEvent.findMany({
        where: { applicationId: olena.applicationId, kind: 'followup_sent' },
        select: { payload: true, occurredAt: true },
      }),
    ).toEqual([{ payload: {}, occurredAt: NOW }]);
    expect(await testApp.prisma.reminder.findMany({ select: { status: true } })).toEqual([
      { status: 'done' },
    ]);
  });

  it('answers 422 at Idempotency-Key to a sent mark without a key and records nothing', async () => {
    const olena = await owner();

    const response = await callRoute(testApp.app, {
      method: 'post',
      path: `${followupPath(olena.applicationId)}/sent`,
      accessToken: olena.accessToken,
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ errors: [{ path: 'Idempotency-Key' }] });
    expect(await testApp.prisma.timelineEvent.count({ where: { kind: 'followup_sent' } })).toBe(0);
  });

  it.each(FOLLOWUP_ROUTES)(
    'answers 401 to $method followup$suffix without a token',
    async ({ method, suffix }) => {
      const olena = await owner();

      const response = await callRoute(testApp.app, {
        method,
        path: `${followupPath(olena.applicationId)}${suffix}`,
      });

      expect(response.status).toBe(401);
    },
  );
});
