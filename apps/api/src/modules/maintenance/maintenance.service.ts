import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import { notFound } from '../../common/app-error.js';
import type { Env } from '../../config/env.js';
import { QUEUES } from '../../queues/queues.js';
import { type JobAccepted, MAINTENANCE_JOBS, type PingJob } from './maintenance.jobs.js';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectQueue(QUEUES.maintenance.name) private readonly queue: Queue,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async enqueuePing(ping: PingJob): Promise<JobAccepted> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw notFound();
    }
    const job = await this.queue.add(MAINTENANCE_JOBS.ping, ping);
    if (job.id === undefined) {
      throw new Error('The maintenance queue returned a job without an id');
    }
    return { jobId: job.id };
  }
}
