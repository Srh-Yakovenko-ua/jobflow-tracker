import { buildDesignReasons, designInsightsBody } from '@jobflow/shared/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { ANALYTICS, analyticsClientProvider, jsonReply } from '../../test/analytics-client.js';
import { recordFetch, refusedConnection, stalled, timeOutAtOnce } from '../../test/fetch.js';
import { DESIGN_WEAK_SPOTS, INTERVIEW_PREP_VACANCY } from '../../test/interview-prep.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { StubQueue, unreachableQueues } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import type { InterviewPrepRequestedPayload } from './interview-prep.events.js';
import { InterviewPrepQueueService } from './interview-prep-queue.service.js';

const log = memoryLog();

const NOTE_MARKER = 'note-marker-7f3a';

const REQUESTED: InterviewPrepRequestedPayload = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  aiJobId: AI_JOB_ID,
  requestId: 'req-prep-1',
  input: INTERVIEW_PREP_VACANCY,
};

function insightsWithNoteText() {
  const body = designInsightsBody();
  const insights = body.insights.map((insight) =>
    insight.block === 'reasons' ? { ...insight, body: `${insight.body} ${NOTE_MARKER}` } : insight,
  );
  return { ...body, insights };
}

const analyticsReplies = {
  [`${ANALYTICS}/reasons`]: jsonReply(buildDesignReasons()),
  [`${ANALYTICS}/insights`]: jsonReply(insightsWithNoteText()),
};

const NO_WEAK_SPOTS = { reasons: [], topics: [] };

async function queueing(queue: StubQueue = new StubQueue('ai')) {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const moduleRef = await compileProcessorModule(log.sink, [
    InterviewPrepQueueService,
    analyticsClientProvider(),
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  const enqueue = () => moduleRef.get(InterviewPrepQueueService).enqueue(REQUESTED);
  return { ai, queue, enqueue };
}

beforeEach(() => {
  log.lines.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InterviewPrepQueueService.enqueue', () => {
  it('queues the vacancy part with the company-side reason codes and the topic codes, and no insight text', async () => {
    const calls = recordFetch({ replies: analyticsReplies, decodeBody: () => null });
    const { queue, enqueue } = await queueing();

    await enqueue();

    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          kind: 'interview_prep',
          userId: OLENA_ID,
          applicationId: APPLICATION_ID,
          aiJobId: AI_JOB_ID,
          requestId: 'req-prep-1',
          input: {
            ...INTERVIEW_PREP_VACANCY,
            weakSpots: DESIGN_WEAK_SPOTS,
          },
        },
      },
    ]);
    expect(JSON.stringify(queue.jobs)).not.toContain(NOTE_MARKER);
    expect(calls.map(({ url }) => url).sort()).toEqual(Object.keys(analyticsReplies).sort());
  });

  it.each([
    {
      case: 'refuses the connection',
      reply: () => Promise.reject(refusedConnection),
      errorType: 'not_ready',
    },
    { case: 'stays silent', reply: stalled, errorType: 'analytics_timeout' },
  ])(
    'queues the pack without weak spots and logs a warning when analytics $case',
    async ({ reply, errorType }) => {
      timeOutAtOnce();
      recordFetch({ replies: reply, decodeBody: () => null });
      const { queue, enqueue } = await queueing();

      await enqueue();

      expect(queue.jobs.map(({ data }) => data)).toEqual([
        expect.objectContaining({ input: { ...INTERVIEW_PREP_VACANCY, weakSpots: NO_WEAK_SPOTS } }),
      ]);
      expect(log.parsed()).toContainEqual(
        expect.objectContaining({
          level: 40,
          requestId: 'req-prep-1',
          aiJobId: AI_JOB_ID,
          errorType,
          msg: 'interview prep without weak spots',
        }),
      );
    },
  );

  it.each(unreachableQueues('ai'))(
    'fails the job as not_ready and rethrows when the queue $case',
    async ({ queue, error }) => {
      recordFetch({ replies: analyticsReplies, decodeBody: () => null });
      const { ai, enqueue } = await queueing(queue);

      await expect(enqueue()).rejects.toThrow(error);

      expect(ai.jobs.get(AI_JOB_ID)).toMatchObject({ status: 'failed', errorType: 'not_ready' });
    },
  );
});
