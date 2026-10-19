import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { type Processor, Queue, Worker } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { configModule } from '../config/app-config.js';
import { testQueuePrefix } from '../test/bull-config.js';
import { queueOptions, QUEUES } from './queues.js';

const STALL_TIMINGS = { lockDuration: 1000, stalledInterval: 500 } as const;

describe('a job whose worker is killed mid-job', () => {
  let options: ReturnType<typeof queueOptions>;
  let queue: Queue;
  const workers: Worker[] = [];

  function stallWorker(processor: Processor): Worker {
    const worker = new Worker(queue.name, processor, { ...options, ...STALL_TIMINGS });
    workers.push(worker);
    return worker;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [configModule] }).compile();
    options = { ...queueOptions(moduleRef.get(ConfigService)), prefix: testQueuePrefix() };
    queue = new Queue(QUEUES.maintenance.name, options);
  });

  afterAll(async () => {
    await Promise.all(workers.map((worker) => worker.close(true)));
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('is not lost: a worker started afterwards completes the same job', async () => {
    const job = await queue.add('ping', { requestId: 'it-stalled' });
    const killed = stallWorker(() => new Promise<never>(() => undefined));
    await expect.poll(() => queue.getJobState(job.id ?? '')).toBe('active');
    await killed.close(true);

    stallWorker(() => Promise.resolve('done'));
    await expect.poll(() => queue.getJobState(job.id ?? ''), { timeout: 4000 }).toBe('completed');
  });
});
