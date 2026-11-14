import {
  captureRetryResponseSchema,
  planSchema,
  summaryArchiveSchema,
  summaryResponseSchema,
} from '@jobflow/shared';
import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import { describe, expect, it, vi } from 'vitest';

import { Clock } from '../../common/clock.js';
import { rateLimitedTestingModule, useTestApp } from '../../test/app.js';
import { type SignedInSearcher, signedInWithSearch } from '../../test/applications.js';
import { callRoute, statusAndType } from '../../test/http.js';
import { outboxRows } from '../../test/outbox.js';
import { expectHourlyAiLimit } from '../../test/rate-limit.js';
import {
  archive,
  planItemPath,
  planPath,
  SUMMARIES_PATH,
  summaryOwner,
} from '../../test/summaries.js';
import { NOW, settableClock } from '../../test/time.js';

vi.hoisted(() => {
  vi.stubEnv('RATE_LIMIT_AI_PER_HOUR', '2');
});

const clock = settableClock(NOW);

const OUTPUT = buildMonthlySummaryOutput();

describe('the monthly summary API', () => {
  const testApp = useTestApp(() =>
    rateLimitedTestingModule().overrideProvider(Clock).useValue(clock),
  );

  const generate = ({ accessToken }: Pick<SignedInSearcher, 'accessToken'>) =>
    callRoute(testApp.app, { method: 'post', path: SUMMARIES_PATH, accessToken });

  const latest = ({ accessToken }: Pick<SignedInSearcher, 'accessToken'>) =>
    callRoute(testApp.app, { method: 'get', path: `${SUMMARIES_PATH}/latest`, accessToken });

  const saveAsPlan = (accessToken: string, aiJobId: string) =>
    callRoute(testApp.app, { method: 'post', path: planPath(aiJobId), accessToken });

  it('answers 202 with a queued monthly_summary job and writes the request event of the month that ended', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const response = await generate(olena);

    expect(response.status).toBe(202);
    const { jobId } = captureRetryResponseSchema.parse(response.body);
    expect(
      await testApp.prisma.aiJob.findMany({ select: { id: true, kind: true, status: true } }),
    ).toEqual([{ id: jobId, kind: 'monthly_summary', status: 'queued' }]);
    expect(await outboxRows(testApp.prisma, { eventType: 'summary.requested' })).toEqual([
      {
        aggregate: 'user',
        aggregateId: olena.userId,
        eventType: 'summary.requested',
        payload: {
          userId: olena.userId,
          aiJobId: jobId,
          searchId: olena.searchId,
          month: '2026-09',
          requestId: response.get('x-request-id'),
          fresh: true,
        },
      },
    ]);
  });

  it('answers the running job to a second request and writes one event', async () => {
    const olena = await signedInWithSearch(testApp.prisma);

    const first = await generate(olena);
    const second = await generate(olena);

    expect(second.body).toEqual(first.body);
    expect(await outboxRows(testApp.prisma, { eventType: 'summary.requested' })).toHaveLength(1);
  });

  it('answers 409 without an active search and stores no job', async () => {
    const olena = await signedInWithSearch(testApp.prisma, { status: 'archived' });

    expect(statusAndType(await generate(olena))).toEqual([409, 'conflict']);
    expect(await testApp.prisma.aiJob.count()).toBe(0);
  });

  it('answers 429 to the third request of one user in an hour, and not to another user', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);

    await expectHourlyAiLimit({ caller: olena, send: generate });
    expect((await generate(bohdan)).status).toBe(202);
  });

  it('answers no summary and no job before the first one, then the done summary of the previous month with its plan', async () => {
    const olena = await signedInWithSearch(testApp.prisma);
    expect((await latest(olena)).body).toEqual({ summary: null, job: null });

    const owner = await summaryOwner(testApp.prisma);
    const plan = planSchema.parse((await saveAsPlan(owner.accessToken, owner.aiJobId)).body);
    const response = await latest(owner);

    expect(response.status).toBe(200);
    expect(summaryResponseSchema.parse(response.body)).toEqual({
      summary: {
        aiJobId: owner.aiJobId,
        month: '2026-09',
        text: OUTPUT.summary,
        actions: OUTPUT.actions,
        generatedAt: NOW.toISOString(),
        planId: plan.id,
      },
      job: { id: owner.aiJobId, status: 'done' },
    });
  });

  it('answers the summarized month with the progress of its saved plan, and an empty archive to another user', async () => {
    const olena = await summaryOwner(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const plan = planSchema.parse((await saveAsPlan(olena.accessToken, olena.aiJobId)).body);
    await callRoute(testApp.app, {
      method: 'patch',
      path: planItemPath(plan.id, plan.items[0]?.id ?? ''),
      accessToken: olena.accessToken,
      body: { done: true },
    });
    const { summary } = summaryResponseSchema.parse((await latest(olena)).body);

    const response = await archive(testApp.app, olena);

    expect(response.status).toBe(200);
    expect(summaryArchiveSchema.parse(response.body)).toEqual({
      items: [{ ...summary, planId: plan.id, plan: { items: 4, done: 1 } }],
    });
    expect((await archive(testApp.app, bohdan)).body).toEqual({ items: [] });
  });

  it("answers 404 to saving another user's summary as a plan and stores no plan", async () => {
    const olena = await summaryOwner(testApp.prisma);
    const bohdan = await signedInWithSearch(testApp.prisma);

    expect(statusAndType(await saveAsPlan(bohdan.accessToken, olena.aiJobId))).toEqual([
      404,
      'not_found',
    ]);
    expect(await testApp.prisma.plan.count()).toBe(0);
  });

  it('answers 422 to a plan request for an id that is not a uuid', async () => {
    const olena = await summaryOwner(testApp.prisma);

    const response = await saveAsPlan(olena.accessToken, 'not-a-uuid');

    expect(statusAndType(response)).toEqual([422, 'validation_error']);
  });

  it.each([
    { method: 'get', path: SUMMARIES_PATH },
    { method: 'get', path: `${SUMMARIES_PATH}/latest` },
    { method: 'post', path: SUMMARIES_PATH },
    { method: 'post', path: planPath('0199f0a0-0000-7000-8000-000000000201') },
  ] as const)('answers 401 to $method $path without a token', async ({ method, path }) => {
    expect((await callRoute(testApp.app, { method, path })).status).toBe(401);
  });
});
