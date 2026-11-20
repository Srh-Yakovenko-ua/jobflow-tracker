import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID, aiQueueProviders, FakeAiRepository, VACANCY_TEXT } from '../../test/ai.js';
import { CAPTURE_REQUESTED, FakeApplicationDrafts } from '../../test/capture.js';
import { memoryLog } from '../../test/memory-log.js';
import { compileProcessorModule } from '../../test/processor.js';
import {
  APPLICATION_ID,
  BOHDAN_ID,
  FINAL_DELIVERY,
  FIRST_DELIVERY,
  MOVE_EVENT_ID,
  OLENA_ID,
} from '../../test/service-fixtures.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { ApplicationDraftsService } from '../applications/index.js';
import { CaptureQueueService } from './capture-queue.service.js';

const log = memoryLog();

async function serviceWith(queue: StubQueue = new StubQueue('ai')) {
  const ai = new FakeAiRepository();
  ai.queueJob(OLENA_ID);
  const moduleRef = await compileProcessorModule(log.sink, [
    CaptureQueueService,
    { provide: ApplicationDraftsService, useValue: new FakeApplicationDrafts() },
    ...aiQueueProviders(queue, ai),
  ]);
  return { queue, ai, service: moduleRef.get(CaptureQueueService) };
}

describe('CaptureQueueService.enqueue', () => {
  beforeEach(() => {
    log.lines.length = 0;
  });

  it('adds one ai.complete job under the ai job id with the pasted text as its input', async () => {
    const { queue, service } = await serviceWith();

    await service.enqueue(CAPTURE_REQUESTED, FIRST_DELIVERY);

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
    const { queue, ai, service } = await serviceWith();

    await service.enqueue({ ...CAPTURE_REQUESTED, userId: BOHDAN_ID }, FIRST_DELIVERY);

    expect(queue.jobs).toEqual([]);
    expect(ai.jobs.get(AI_JOB_ID)).toEqual({ userId: OLENA_ID, status: 'queued', step: 1 });
    expect(log.parsed()).toEqual([]);
  });

  it('gives up on a silent queue after the publish limit so the event is retried', async () => {
    const { ai, service } = await serviceWith(new SilentQueue('ai'));

    await expect(service.enqueue(CAPTURE_REQUESTED, FIRST_DELIVERY)).rejects.toThrow(
      'timed out after 2000 ms',
    );

    expect(ai.jobs.get(AI_JOB_ID)).toEqual({ userId: OLENA_ID, status: 'queued', step: 1 });
  });

  it.each([
    {
      attempt: 'a capture whose enqueue fails every attempt ends failed, not queued',
      delivery: FINAL_DELIVERY,
      job: { status: 'failed', errorType: 'not_ready' },
      warnings: [['vacancy_parse job not queued', MOVE_EVENT_ID]],
    },
    {
      attempt: 'keeps the job queued on an earlier failed attempt so the event retries',
      delivery: FIRST_DELIVERY,
      job: { status: 'queued', step: 1 },
      warnings: [],
    },
  ])('$attempt', async ({ delivery, job, warnings }) => {
    const { ai, service } = await serviceWith(new RefusingQueue('ai'));

    await expect(service.enqueue(CAPTURE_REQUESTED, delivery)).rejects.toThrow(
      'Connection is closed.',
    );

    expect(ai.jobs.get(AI_JOB_ID)).toEqual(expect.objectContaining(job));
    expect(
      log
        .parsed()
        .filter(({ level }) => level === 40)
        .map(({ msg, eventId }) => [msg, eventId]),
    ).toEqual(warnings);
  });
});
