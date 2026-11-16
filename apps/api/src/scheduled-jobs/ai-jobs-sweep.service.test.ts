import { getQueueToken } from '@nestjs/bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { StubQueue, unreachableQueues } from '../test/stub-queues.js';
import { NOW, settableClock } from '../test/time.js';
import { AiJobsSweepService } from './ai-jobs-sweep.service.js';
import type { AiFailureWindow, StaleAiJobs } from './scheduled-jobs.repository.js';
import { ScheduledJobsRepository } from './scheduled-jobs.repository.js';

const log = memoryLog();

type RepositoryCall =
  { method: string; sweep: StaleAiJobs } | { method: string; window: AiFailureWindow };

const UNSETTLED_FAILURE_IDS = ['ai-job-1', 'ai-job-2'];

class FakeAiJobsRepository {
  readonly calls: RepositoryCall[] = [];

  failStaleAiJobs(sweep: StaleAiJobs): Promise<number> {
    this.calls.push({ method: 'failStaleAiJobs', sweep });
    return Promise.resolve(5);
  }

  unsettledAiFailureIds(window: AiFailureWindow): Promise<string[]> {
    this.calls.push({ method: 'unsettledAiFailureIds', window });
    return Promise.resolve(UNSETTLED_FAILURE_IDS);
  }
}

describe('AiJobsSweepService', () => {
  const repository = new FakeAiJobsRepository();
  const aiQueue = new StubQueue('ai');
  let service: AiJobsSweepService;
  let close: () => Promise<void>;

  const compileService = (queue: StubQueue) =>
    compileProcessorModule(log.sink, [
      AiJobsSweepService,
      { provide: ScheduledJobsRepository, useValue: repository },
      { provide: Clock, useValue: settableClock(NOW) },
      { provide: getQueueToken('ai'), useValue: queue },
    ]);

  beforeAll(async () => {
    const moduleRef = await compileService(aiQueue);
    service = moduleRef.get(AiJobsSweepService);
    close = () => moduleRef.close();
  });

  beforeEach(() => {
    log.lines.length = 0;
    repository.calls.length = 0;
    aiQueue.retried.length = 0;
    aiQueue.gone.clear();
  });

  afterAll(async () => {
    await close();
  });

  it('fails ai jobs created more than 60 minutes ago as abandoned, finished now', async () => {
    await expect(service.sweepStaleAiJobs()).resolves.toBe(5);

    expect(repository.calls).toEqual([
      {
        method: 'failStaleAiJobs',
        sweep: {
          createdBefore: new Date('2026-10-22T08:00:00.000Z'),
          now: new Date('2026-10-22T09:00:00.000Z'),
          errorType: 'ai_abandoned',
        },
      },
    ]);
  });

  it('redelivers each unsettled ai failure finished between a day and five minutes ago, twenty at most, as a retry of its failed BullMQ job', async () => {
    await expect(service.redeliverUnsettledAiFailures()).resolves.toBe(2);

    expect(repository.calls).toEqual([
      {
        method: 'unsettledAiFailureIds',
        window: {
          finishedAfter: new Date('2026-10-21T09:00:00.000Z'),
          finishedBefore: new Date('2026-10-22T08:55:00.000Z'),
          take: 20,
        },
      },
    ]);
    expect(aiQueue.retried).toEqual([
      ['ai-job-1', 'failed'],
      ['ai-job-2', 'failed'],
    ]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ count: 2, msg: 'ai failures redelivered' }),
    ]);
  });

  it('counts nothing for an unsettled ai failure whose BullMQ job is gone and redelivers the rest', async () => {
    aiQueue.gone.add('ai-job-1');

    await expect(service.redeliverUnsettledAiFailures()).resolves.toBe(1);

    expect(aiQueue.retried).toEqual([['ai-job-2', 'failed']]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ count: 1, msg: 'ai failures redelivered' }),
    ]);
  });

  it.each(unreachableQueues('ai'))(
    'logs each unsettled ai failure as not redelivered and resolves with count 0 when the queue $case',
    async ({ queue, error }) => {
      const moduleRef = await compileService(queue);

      await expect(moduleRef.get(AiJobsSweepService).redeliverUnsettledAiFailures()).resolves.toBe(
        0,
      );

      await moduleRef.close();
      expect(log.parsed()).toEqual([
        ...UNSETTLED_FAILURE_IDS.map((aiJobId): unknown =>
          expect.objectContaining({
            level: 40,
            msg: 'ai failure not redelivered',
            aiJobId,
            err: error,
          }),
        ),
        expect.objectContaining({ count: 0, msg: 'ai failures redelivered' }),
      ]);
    },
    10_000,
  );
});
