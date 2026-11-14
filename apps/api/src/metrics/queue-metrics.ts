import { getQueueToken } from '@nestjs/bullmq';
import { type FactoryProvider, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Gauge } from 'prom-client';

import { errorMessageOf } from '../common/error-message.js';
import { DEPENDENCY_LIMITS, withinLimit } from '../common/probe.js';
import { QUEUE_NAMES } from '../queues/queues.js';
import { MetricsRegistry } from './metrics-registry.js';

export const QUEUE_METRICS = Symbol('QUEUE_METRICS');

const JOB_STATES = ['waiting', 'active', 'delayed', 'failed'] as const;

type QueueJobsGauge = Gauge<'queue' | 'state'>;

export type CountedQueue = Pick<Queue, 'name' | 'getJobCounts'>;

type QueueSample = { gauge: QueueJobsGauge; queue: CountedQueue; logger: Logger };

async function sampleQueue({ gauge, queue, logger }: QueueSample): Promise<void> {
  try {
    const counts = await withinLimit(
      queue.getJobCounts(...JOB_STATES),
      DEPENDENCY_LIMITS.pingTimeoutMs,
    );
    for (const state of JOB_STATES) {
      gauge.set({ queue: queue.name, state }, counts[state] ?? 0);
    }
  } catch (error) {
    logger.warn({ queue: queue.name, err: errorMessageOf(error) }, 'queue depth not measured');
  }
}

export const queueMetrics: FactoryProvider<QueueJobsGauge> = {
  provide: QUEUE_METRICS,
  inject: [MetricsRegistry, ...QUEUE_NAMES.map((name) => getQueueToken(name))],
  useFactory: (metrics: MetricsRegistry, ...queues: CountedQueue[]) => {
    const logger = new Logger('QueueMetrics');
    return new Gauge({
      name: 'jobflow_queue_jobs',
      help: 'Jobs per queue and state',
      labelNames: ['queue', 'state'] as const,
      registers: [metrics.registry],
      async collect() {
        this.reset();
        await Promise.all(queues.map((queue) => sampleQueue({ gauge: this, queue, logger })));
      },
    });
  },
};
