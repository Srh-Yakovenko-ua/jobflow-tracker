import { interviewPrepResponseSchema } from '@jobflow/shared';
import {
  buildDesignReasons,
  designInsightsBody,
  INTERVIEW_PREP_OUTPUT,
} from '@jobflow/shared/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AnalyticsClient } from '../../analytics-client/index.js';
import { Clock } from '../../common/clock.js';
import { FakeAiClient, INTERVIEW_PREP_COMPLETION } from '../../test/ai.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  AI_WORKER_TEST,
  applicationAiRoute,
  postedTwice,
  servedFromCache,
} from '../../test/application-ai-route.js';
import { type ScoredOwner, scoredOwner } from '../../test/cv-hints.js';
import { createNotes, createScheduledEvent } from '../../test/factories.js';
import { statusAndType } from '../../test/http.js';
import { interviewPrepPath } from '../../test/interview-prep.js';
import { MATCHABLE_ROW } from '../../test/match.js';
import { memoryLog } from '../../test/memory-log.js';
import { outboxRows } from '../../test/outbox.js';
import { fixedClock, minutesAfter, NOW } from '../../test/time.js';
import { useTestWorkers } from '../../test/worker.js';
import { AiClient } from '../ai/index.js';
import { InterviewPrepRepository } from './interview-prep.repository.js';

const REQUESTED_EVENT = { eventType: 'application.interview_prep_requested' };

const NOTE_MARKER = 'note-marker-int-5c1e';

const log = memoryLog();

const ai = new FakeAiClient();

const weakSpotsAnalytics = {
  forUser: () => ({
    reasons: () => Promise.resolve(buildDesignReasons()),
    insights: () => Promise.resolve(designInsightsBody()),
  }),
};

describe('the interview prep API', () => {
  const testApp = useTestApp(() =>
    appTestingModule().overrideProvider(Clock).useValue(fixedClock(NOW)),
  );
  const workers = useTestWorkers(log.sink, (builder) =>
    builder
      .overrideProvider(AiClient)
      .useValue(ai)
      .overrideProvider(AnalyticsClient)
      .useValue(weakSpotsAnalytics)
      .overrideProvider(Clock)
      .useValue(fixedClock(NOW)),
  );

  beforeEach(() => {
    ai.restart(INTERVIEW_PREP_COMPLETION);
    log.lines.length = 0;
  });

  async function interviewee(): Promise<ScoredOwner> {
    const owner = await scoredOwner(testApp.prisma);
    const { applicationId } = owner;
    await createScheduledEvent(testApp.prisma, {
      applicationId,
      kind: 'tech_interview',
      startsAt: minutesAfter(1440),
    });
    await createNotes(testApp.prisma, [
      { applicationId, body: `Провалив алгоритми ${NOTE_MARKER}` },
    ]);
    return owner;
  }

  const route = applicationAiRoute(testApp, {
    path: interviewPrepPath,
    response: interviewPrepResponseSchema,
  });
  const { call, requested, read } = route;

  const prepJobCount = () => testApp.prisma.aiJob.count({ where: { kind: 'interview_prep' } });

  it(
    'answers queued, then done with the pack, serves a second request from the cached ai_results row and records interview_prep_ready once per job',
    AI_WORKER_TEST,
    async () => {
      const olena = await interviewee();
      const worker = await workers.compile();

      const run = await servedFromCache(route, { caller: olena, worker });
      const { firstId, secondId, second } = run;

      expect(run.whileQueued).toEqual({
        result: null,
        job: { id: firstId, status: 'queued', errorType: null },
      });
      expect([run.first, second].map(({ status, aiResultId }) => [status, aiResultId])).toEqual([
        ['done', run.first.aiResultId],
        ['done', run.first.aiResultId],
      ]);
      expect(secondId).not.toBe(firstId);
      expect(ai.calls).toEqual([expect.objectContaining({ kind: 'interview_prep' })]);
      expect(ai.calls[0]?.input).toMatchObject({
        weakSpots: { topics: ['algorithms'] },
      });
      expect(await read(olena)).toEqual({
        result: { ...INTERVIEW_PREP_OUTPUT, generatedAt: second.finishedAt?.toISOString() },
        job: { id: secondId, status: 'done', errorType: null },
      });
      const notices = await testApp.prisma.notification.findMany({
        where: { userId: olena.userId, type: 'interview_prep_ready' },
        select: { payload: true },
        orderBy: { createdAt: 'asc' },
      });
      const noticeOf = (aiJobId: string) => ({
        payload: {
          aiJobId,
          applicationId: olena.applicationId,
          eventKind: 'tech_interview',
          startsAt: '2026-10-23T09:00:00.000Z',
        },
      });
      expect(notices).toMatchObject([noticeOf(firstId), noticeOf(secondId)]);
      expect(JSON.stringify(ai.calls)).not.toContain(NOTE_MARKER);
      expect(log.lines.join('')).not.toContain(NOTE_MARKER);
    },
  );

  it('writes the request event with the vacancy part and no note text, and answers the running job to a second request', async () => {
    const olena = await interviewee();

    const { first, second, jobId, requestId } = await postedTwice(route, olena);

    expect([first.status, second.status]).toEqual([202, 202]);
    expect([first.body, second.body]).toEqual([{ jobId }, { jobId }]);
    const rows = await outboxRows(testApp.prisma, REQUESTED_EVENT);
    expect(rows).toMatchObject([
      {
        aggregateId: olena.applicationId,
        payload: {
          userId: olena.userId,
          applicationId: olena.applicationId,
          aiJobId: jobId,
          requestId,
          input: {
            position: MATCHABLE_ROW.position,
            interviewKind: 'tech_interview',
            requirements: MATCHABLE_ROW.stack,
          },
        },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain(NOTE_MARKER);
  });

  it('answers 409 to a request without a planned interview ahead and stores no job', async () => {
    const olena = await scoredOwner(testApp.prisma);
    await createScheduledEvent(testApp.prisma, {
      applicationId: olena.applicationId,
      kind: 'tech_interview',
      startsAt: minutesAfter(-60),
    });

    expect(statusAndType(await call('post', olena))).toEqual([409, 'conflict']);
    expect(await prepJobCount()).toBe(0);
  });

  it.each(['get', 'post'] as const)(
    "answers 404 to %s interview-prep on another user's application and stores nothing",
    async (method) => {
      const olena = await interviewee();
      const bohdan = await scoredOwner(testApp.prisma);

      const response = await call(method, { ...olena, accessToken: bohdan.accessToken });

      expect(statusAndType(response)).toEqual([404, 'not_found']);
      expect(await prepJobCount()).toBe(0);
    },
  );

  it('answers 401 without a token and 422 to a malformed id on both interview-prep routes', async () => {
    const olena = await interviewee();
    const anonymous = { applicationId: olena.applicationId };
    const malformed = { ...olena, applicationId: 'bad' };

    const responses = await Promise.all(
      (['get', 'post'] as const).flatMap((method) => [
        call(method, anonymous),
        call(method, malformed),
      ]),
    );

    expect(responses.map(({ status }) => status)).toEqual([401, 422, 401, 422]);
  });

  it("reads and locks OLENA's interview prep rows for OLENA only", async () => {
    const olena = await interviewee();
    const bohdan = await scoredOwner(testApp.prisma);
    const jobId = await requested(olena);
    const repository = testApp.app.get(InterviewPrepRepository);
    const { applicationId } = olena;
    const lockAs = (userId: string) =>
      testApp.prisma.$transaction((tx) =>
        repository.lockApplication(userId, { applicationId, tx }),
      );

    const asBohdan = await Promise.all([
      repository.findSource(bohdan.userId, { applicationId, now: NOW }),
      repository.findLatest(bohdan.userId, applicationId),
      lockAs(bohdan.userId),
    ]);
    const asOlena = await Promise.all([
      repository.findLatest(olena.userId, applicationId),
      lockAs(olena.userId),
    ]);

    expect(asBohdan).toEqual([null, null, null]);
    expect(asOlena).toEqual([
      { aiJobs: [expect.objectContaining({ id: jobId, status: 'queued' })] },
      { runningJobId: jobId },
    ]);
  });
});
