import type { YearMonth } from '@jobflow/shared';
import {
  buildDesignFunnel,
  buildDesignReasons,
  buildDesignResumeAb,
  buildDesignSources,
  buildDesignWhatIfForecast,
  buildForecast,
  buildInsufficientForecast,
  buildMonthlySummaryInput,
  designInsightsBody,
} from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsClient } from '../../analytics-client/index.js';
import { validateEnv } from '../../config/env.js';
import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { testJwtKeys } from '../../test/auth.js';
import { exampleEnv } from '../../test/example-env.js';
import {
  type FetchReply,
  recordFetch,
  refusedConnection,
  stalled,
  timeOutAtOnce,
} from '../../test/fetch.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { OLENA_ID, SEARCH_ID } from '../../test/service-fixtures.js';
import { StubQueue } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import { PlansService } from '../plans/index.js';
import type { SummaryRequestedPayload } from './summaries.events.js';
import { SummaryQueueService } from './summary-queue.service.js';

const log = memoryLog();

const ANALYTICS_URL = 'http://analytics.test:8000';

const ANALYTICS = `${ANALYTICS_URL}/analytics`;

const FIRST_DELIVERY = { eventId: 'event-1', finalAttempt: false };

const REQUESTED: SummaryRequestedPayload = {
  userId: OLENA_ID,
  aiJobId: AI_JOB_ID,
  searchId: SEARCH_ID,
  month: '2026-08',
  requestId: 'req-1',
};

const WHAT_IF_URL = `${ANALYTICS}/forecast?searchId=${SEARCH_ID}&improve=tech_interview%3A0.6`;

const json =
  (body: unknown): FetchReply =>
  () =>
    Response.json(body);

const designReplies = (forecast: unknown = buildForecast()): Record<string, FetchReply> => ({
  [`${ANALYTICS}/funnel?searchId=${SEARCH_ID}&month=2026-08`]: json(buildDesignFunnel()),
  [`${ANALYTICS}/forecast?searchId=${SEARCH_ID}`]: json(forecast),
  [`${ANALYTICS}/reasons?searchId=${SEARCH_ID}`]: json(buildDesignReasons()),
  [`${ANALYTICS}/sources?searchId=${SEARCH_ID}`]: json(buildDesignSources()),
  [`${ANALYTICS}/resume-ab`]: json(buildDesignResumeAb()),
  [`${ANALYTICS}/insights?searchId=${SEARCH_ID}`]: json(designInsightsBody()),
  [WHAT_IF_URL]: json(buildDesignWhatIfForecast()),
});

class RecordingPlanProgress {
  readonly months: YearMonth[] = [];

  progress(_userId: string, month: YearMonth) {
    this.months.push(month);
    return Promise.resolve({ items: 4, done: 3 });
  }
}

const analyticsClient = () =>
  new AnalyticsClient(
    new ConfigService(validateEnv({ ...exampleEnv, ANALYTICS_URL })),
    testJwtKeys,
  );

async function queueWithFakes() {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const queue = new StubQueue('ai');
  const plans = new RecordingPlanProgress();
  const moduleRef = await compileProcessorModule(log.sink, [
    SummaryQueueService,
    { provide: AnalyticsClient, useValue: analyticsClient() },
    { provide: PlansService, useValue: plans },
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  const service = moduleRef.get(SummaryQueueService);
  const enqueue = (delivery = FIRST_DELIVERY) => service.enqueue(REQUESTED, delivery);
  return { ai, queue, plans, enqueue };
}

beforeEach(() => {
  log.lines.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SummaryQueueService.enqueue', () => {
  it('queues the monthly summary input built from the analytics of the search, the month and the previous plan', async () => {
    const calls = recordFetch({ replies: designReplies(), decodeBody: () => null });
    const { queue, plans, enqueue } = await queueWithFakes();

    await enqueue();

    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          aiJobId: AI_JOB_ID,
          userId: OLENA_ID,
          kind: 'monthly_summary',
          input: buildMonthlySummaryInput(),
          requestId: 'req-1',
        },
      },
    ]);
    expect(calls.map(({ url }) => url)).toContain(WHAT_IF_URL);
    expect(plans.months).toEqual(['2026-08']);
  });

  it('asks for no what-if forecast when the plain forecast is insufficient', async () => {
    const calls = recordFetch({
      replies: designReplies(buildInsufficientForecast()),
      decodeBody: () => null,
    });
    const { queue, enqueue } = await queueWithFakes();

    await enqueue();

    expect(calls.map(({ url }) => url)).not.toContain(WHAT_IF_URL);
    expect(queue.jobs[0]?.data).toMatchObject({ input: { whatIf: null } });
  });

  it.each([
    { case: 'refuses the connection', reply: () => Promise.reject(refusedConnection) },
    { case: 'stays silent', reply: stalled },
  ])('rethrows and keeps the job queued when analytics $case', async ({ reply }) => {
    timeOutAtOnce();
    recordFetch({ replies: reply, decodeBody: () => null });
    const { ai, queue, enqueue } = await queueWithFakes();

    await expect(enqueue()).rejects.toMatchObject({ name: 'AnalyticsServiceError' });

    expect(ai.jobs.get(AI_JOB_ID)).toMatchObject({ status: 'queued' });
    expect(queue.jobs).toEqual([]);
  });

  it('fails the job as not_ready on the final attempt and still rethrows', async () => {
    recordFetch({ replies: () => Promise.reject(refusedConnection), decodeBody: () => null });
    const { ai, enqueue } = await queueWithFakes();

    await expect(enqueue({ ...FIRST_DELIVERY, finalAttempt: true })).rejects.toMatchObject({
      status: 503,
      type: 'not_ready',
    });

    expect(ai.jobs.get(AI_JOB_ID)).toMatchObject({ status: 'failed', errorType: 'not_ready' });
    expect(log.parsed()).toEqual([
      expect.objectContaining({ aiJobId: AI_JOB_ID, msg: 'monthly summary failed' }),
    ]);
  });
});
