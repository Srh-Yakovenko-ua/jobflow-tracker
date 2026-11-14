import { getQueueToken } from '@nestjs/bullmq';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { QUEUE_NAMES, QUEUES } from '../queues/queues.js';
import { memoryLog } from '../test/memory-log.js';
import { samplesOf } from '../test/metrics.js';
import { compileProcessorModule } from '../test/processor.js';
import { MetricsRegistry } from './metrics-registry.js';
import { queueMetrics } from './queue-metrics.js';

const QUEUE_JOBS = 'jobflow_queue_jobs';

type JobCounts = Record<string, number>;

const AI_COUNTS: JobCounts = { waiting: 3, active: 1, delayed: 0, failed: 2, completed: 9 };

class CountingQueue {
  answer: () => Promise<JobCounts> = () => Promise.resolve({});

  constructor(readonly name: string) {}

  getJobCounts(): Promise<JobCounts> {
    return this.answer();
  }
}

const log = memoryLog();

describe('jobflow_queue_jobs', () => {
  const queues = QUEUE_NAMES.map((name) => new CountingQueue(name));
  const aiQueue = queues.find(({ name }) => name === QUEUES.ai.name);
  let metrics: MetricsRegistry;

  const scraped = async () => {
    const samples = await samplesOf(metrics, QUEUE_JOBS);
    const ofQueue = (name: string) =>
      samples.filter(({ labels }) => Object.values(labels).includes(name));
    return { samples, ofQueue };
  };

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      MetricsRegistry,
      queueMetrics,
      ...queues.map((queue) => ({ provide: getQueueToken(queue.name), useValue: queue })),
    ]);
    metrics = moduleRef.get(MetricsRegistry);
  });

  beforeEach(() => {
    log.lines.length = 0;
    if (aiQueue !== undefined) {
      aiQueue.answer = () => Promise.resolve(AI_COUNTS);
    }
  });

  it('reads waiting, active, delayed and failed of every queue, 0 for a state Redis leaves out', async () => {
    const { samples, ofQueue } = await scraped();

    expect(ofQueue('ai')).toEqual([
      { labels: { queue: 'ai', state: 'waiting' }, value: 3 },
      { labels: { queue: 'ai', state: 'active' }, value: 1 },
      { labels: { queue: 'ai', state: 'delayed' }, value: 0 },
      { labels: { queue: 'ai', state: 'failed' }, value: 2 },
    ]);
    expect(samples).toHaveLength(24);
  });

  it.each([
    { redis: 'refuses', answer: () => Promise.reject(new Error('Connection is closed.')) },
    { redis: 'never answers', answer: () => new Promise<never>(() => undefined) },
  ])(
    "drops that queue's series and warns when its Redis $redis, and the other queues still answer",
    { timeout: DEPENDENCY_LIMITS.pingTimeoutMs + 2000 },
    async ({ answer }) => {
      await scraped();
      if (aiQueue !== undefined) {
        aiQueue.answer = answer;
      }

      const { ofQueue } = await scraped();

      expect(ofQueue('ai')).toEqual([]);
      expect(ofQueue('push')).toHaveLength(4);
      expect(log.parsed()).toEqual([
        expect.objectContaining({ level: 40, msg: 'queue depth not measured', queue: 'ai' }),
      ]);
    },
  );
});
