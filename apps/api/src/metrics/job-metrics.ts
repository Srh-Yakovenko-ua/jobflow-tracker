import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Job } from 'bullmq';
import { Histogram } from 'prom-client';

import { workerHostsOf } from '../queues/worker-hosts.js';
import { MetricsRegistry } from './metrics-registry.js';

type JobOutcome = { queue: string; status: 'completed' | 'failed' };

type TimedJob = Pick<Job, 'processedOn' | 'finishedOn'>;

const MS_PER_SECOND = 1000;

@Injectable()
export class JobMetrics implements OnApplicationBootstrap {
  private readonly duration: Histogram<keyof JobOutcome>;

  constructor(
    private readonly discovery: DiscoveryService,
    metrics: MetricsRegistry,
  ) {
    this.duration = new Histogram({
      name: 'jobflow_job_duration_seconds',
      help: 'Seconds a job ran, from processing start to completion or failure, per queue',
      labelNames: ['queue', 'status'] as const,
      registers: [metrics.registry],
    });
  }

  onApplicationBootstrap(): void {
    for (const { worker } of workerHostsOf(this.discovery)) {
      worker.on('completed', (job) => {
        this.observe(job, { queue: worker.name, status: 'completed' });
      });
      worker.on('failed', (job) => {
        this.observe(job, { queue: worker.name, status: 'failed' });
      });
    }
  }

  private observe(job: TimedJob | undefined, outcome: JobOutcome): void {
    if (job?.processedOn === undefined || job.finishedOn === undefined) {
      return;
    }
    this.duration.observe(outcome, (job.finishedOn - job.processedOn) / MS_PER_SECOND);
  }
}
