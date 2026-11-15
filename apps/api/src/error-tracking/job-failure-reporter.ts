import { AI_JOB_FAILURES } from '@jobflow/shared';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Job } from 'bullmq';

import { workerHostsOf } from '../queues/worker-hosts.js';
import { ErrorReporter } from './error-reporter.js';

type FailedJob = Pick<Job, 'name' | 'finishedOn'>;

const isCrash = (job: FailedJob, error: Error): boolean =>
  job.finishedOn !== undefined && error.message !== AI_JOB_FAILURES.budgetExceeded;

@Injectable()
export class JobFailureReporter implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reporter: ErrorReporter,
  ) {}

  onApplicationBootstrap(): void {
    for (const { worker } of workerHostsOf(this.discovery)) {
      worker.on('failed', (job, error) => {
        if (job === undefined || !isCrash(job, error)) return;
        this.reporter.capture({
          exception: error,
          tags: { queue: worker.name, jobName: job.name },
        });
      });
    }
  }
}
