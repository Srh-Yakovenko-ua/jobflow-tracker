import { getQueueToken } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID, FakeAiRepository, VACANCY_TEXT } from '../../test/ai.js';
import { FakeApplicationDrafts } from '../../test/capture.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import {
  APPLICATION_ID,
  BOHDAN_ID,
  CREATION_EVENT_ID,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { AiService } from '../ai/index.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { CaptureQueueService } from './capture-queue.service.js';

const log = memoryLog();

const PAYLOAD = {
  userId: OLENA_ID,
  applicationId: APPLICATION_ID,
  aiJobId: AI_JOB_ID,
  requestId: 'req-capture-1',
};

const eventWith = (payload: unknown) => ({
  id: CREATION_EVENT_ID,
  type: 'application.capture_requested',
  payload,
});

async function serviceWith(queue: StubQueue = new StubQueue('ai')) {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const moduleRef = await compileProcessorModule(log.sink, [
    CaptureQueueService,
    { provide: ApplicationDraftsService, useValue: new FakeApplicationDrafts() },
    { provide: AiService, useValue: ai },
    { provide: getQueueToken('ai'), useValue: queue },
  ]);
  return { queue, ai, service: moduleRef.get(CaptureQueueService) };
}

describe('CaptureQueueService.enqueue', () => {
  beforeEach(() => {
    log.lines.length = 0;
  });

  it('adds one ai.complete job under the ai job id with the pasted text as its input', async () => {
    const { queue, service } = await serviceWith();

    await service.enqueue(eventWith(PAYLOAD));

    expect(queue.jobs).toEqual([
      {
        id: AI_JOB_ID,
        name: 'ai.complete',
        data: {
          aiJobId: AI_JOB_ID,
          userId: OLENA_ID,
          kind: 'vacancy_parse',
          input: { text: VACANCY_TEXT },
          applicationId: APPLICATION_ID,
          requestId: 'req-capture-1',
        },
      },
    ]);
    expect(log.lines.join('')).not.toContain('Acme');
  });

  it("adds nothing for a draft that is gone or another user's", async () => {
    const { queue, service } = await serviceWith();

    await service.enqueue(eventWith({ ...PAYLOAD, userId: BOHDAN_ID }));

    expect(queue.jobs).toEqual([]);
  });

  it.each([
    { payload: 'without an ai job id', data: { userId: OLENA_ID, applicationId: APPLICATION_ID } },
    { payload: 'that is no object', data: undefined },
  ])('fails an event $payload as unrecoverable and adds nothing', async ({ data }) => {
    const { queue, service } = await serviceWith();

    await expect(service.enqueue(eventWith(data))).rejects.toBeInstanceOf(UnrecoverableError);

    expect(queue.jobs).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'capture event invalid',
        eventId: CREATION_EVENT_ID,
      }),
    ]);
  });

  it('gives up on a silent queue after the publish limit so the event is retried', async () => {
    const { service } = await serviceWith(new SilentQueue('ai'));

    await expect(service.enqueue(eventWith(PAYLOAD))).rejects.toThrow('timed out after 2000 ms');
  });

  it.each([
    {
      attempt: 'a capture whose enqueue fails every attempt ends failed, not queued',
      finalAttempt: true,
      job: { status: 'failed', errorType: 'not_ready' },
      warnings: ['vacancy_parse job not queued'],
    },
    {
      attempt: 'keeps the job queued on an earlier failed attempt so the event retries',
      finalAttempt: false,
      job: { status: 'queued', step: 1 },
      warnings: [],
    },
  ])('$attempt', async ({ finalAttempt, job, warnings }) => {
    const { ai, service } = await serviceWith(new RefusingQueue('ai'));

    await expect(service.enqueue({ ...eventWith(PAYLOAD), finalAttempt })).rejects.toThrow(
      'Connection is closed.',
    );

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(expect.objectContaining(job));
    expect(
      log
        .parsed()
        .filter(({ level }) => level === 40)
        .map(({ msg }) => msg),
    ).toEqual(warnings);
  });
});
