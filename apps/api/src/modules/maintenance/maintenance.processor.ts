import { setTimeout as delay } from 'node:timers/promises';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';

import { QUEUES } from '../../queues/queues.js';
import { pingJobSchema } from './maintenance.jobs.js';

export type ProcessedJob = Pick<Job, 'id' | 'name' | 'queueName' | 'data' | 'attemptsMade'>;

const requestIdSchema = pingJobSchema.pick({ requestId: true });

function jobFields(job: ProcessedJob) {
  return { jobId: job.id, queue: job.queueName, jobName: job.name };
}

@Processor(QUEUES.maintenance.name, { concurrency: QUEUES.maintenance.concurrency })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  async process(job: ProcessedJob): Promise<void> {
    const ping = pingJobSchema.safeParse(job.data);
    if (!ping.success) {
      this.logger.error({ ...jobFields(job), issues: ping.error.issues }, 'ping payload invalid');
      throw new UnrecoverableError('ping payload invalid');
    }
    const fields = { requestId: ping.data.requestId, ...jobFields(job) };
    this.logger.log(fields, 'ping started');
    await delay(ping.data.holdMs);
    this.logger.log(fields, 'ping processed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    const requestId = requestIdSchema.safeParse(job?.data).data?.requestId;
    const fields = job === undefined ? {} : { ...jobFields(job), attemptsMade: job.attemptsMade };
    this.logger.warn({ requestId, ...fields, err: error.message }, 'job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn(
      { queue: QUEUES.maintenance.name, err: error.message },
      'worker connection error',
    );
  }
}
