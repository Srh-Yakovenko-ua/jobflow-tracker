import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type JobsOptions, Queue } from 'bullmq';

import { notFound } from '../../common/app-error.js';
import { redisAnswered } from '../../common/probe.js';
import type { Env } from '../../config/env.js';
import { QUEUES } from '../../queues/queues.js';
import {
  type JobAccepted,
  MAINTENANCE_JOBS,
  MAINTENANCE_SCHEDULES,
  type MaintenanceJobName,
  type MaintenanceScheduleId,
  type PingJob,
} from './maintenance.jobs.js';

export type RunNow = { schedule: MaintenanceScheduleId; requestId: string };

type MaintenanceJobAdd = { name: MaintenanceJobName; data: object; opts?: JobsOptions };

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectQueue(QUEUES.maintenance.name) private readonly queue: Queue,
    private readonly config: ConfigService<Env, true>,
  ) {}

  enqueuePing(ping: PingJob): Promise<JobAccepted> {
    return this.add({ name: MAINTENANCE_JOBS.ping, data: ping });
  }

  runNow({ schedule, requestId }: RunNow): Promise<JobAccepted> {
    const scheduled = MAINTENANCE_SCHEDULES.find(({ id }) => id === schedule);
    if (scheduled === undefined) {
      throw new Error(`No maintenance schedule ${schedule}`);
    }
    const { name, opts } = scheduled.template;
    return this.add({ name, data: { requestId }, opts });
  }

  private async add({ name, data, opts }: MaintenanceJobAdd): Promise<JobAccepted> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'production') {
      throw notFound();
    }
    const job = await redisAnswered(this.queue.add(name, data, opts));
    if (job.id === undefined) {
      throw new Error('The maintenance queue returned a job without an id');
    }
    return { jobId: job.id };
  }
}
