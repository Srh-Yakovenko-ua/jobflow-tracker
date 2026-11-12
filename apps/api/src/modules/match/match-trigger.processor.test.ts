import { UnrecoverableError } from 'bullmq';
import { beforeEach, describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { memoryLog } from '../../test/memory-log.js';
import { processedJob } from '../../test/processed-job.js';
import { compileProcessorModule } from '../../test/processor.js';
import { APPLICATION_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { MatchQueueService, type MatchRequest } from './match-queue.service.js';
import { MatchTriggerProcessor } from './match-trigger.processor.js';

class RecordingMatchQueue {
  readonly requests: (MatchRequest & { userId: string })[] = [];

  request(userId: string, request: MatchRequest): Promise<string | null> {
    this.requests.push({ userId, ...request });
    return Promise.resolve(AI_JOB_ID);
  }
}

const TRIGGER = { userId: OLENA_ID, applicationId: APPLICATION_ID };

const triggerJob = (data: unknown, name = 'match.trigger') =>
  processedJob({ queueName: 'match', name, data, id: '7' });

describe('MatchTriggerProcessor', () => {
  const log = memoryLog();
  let queue: RecordingMatchQueue;
  let processor: MatchTriggerProcessor;

  beforeEach(async () => {
    log.lines.length = 0;
    queue = new RecordingMatchQueue();
    const moduleRef = await compileProcessorModule(log.sink, [
      MatchTriggerProcessor,
      { provide: MatchQueueService, useValue: queue },
    ]);
    processor = moduleRef.get(MatchTriggerProcessor);
  });

  it("requests the application's match for its user and returns the new AI job id", async () => {
    expect(await processor.process(triggerJob(TRIGGER))).toBe(AI_JOB_ID);

    expect(queue.requests).toEqual([{ userId: OLENA_ID, applicationId: APPLICATION_ID }]);
  });

  it.each([
    { case: 'without an application', job: triggerJob({ userId: OLENA_ID }) },
    { case: 'with another job name', job: triggerJob(TRIGGER, 'ai.complete') },
  ])('fails a trigger $case as unrecoverable and requests nothing', async ({ job }) => {
    await expect(processor.process(job)).rejects.toBeInstanceOf(UnrecoverableError);

    expect(queue.requests).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'match trigger invalid', jobId: '7' }),
    ]);
  });
});
