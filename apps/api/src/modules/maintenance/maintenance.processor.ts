import { setTimeout as delay } from 'node:timers/promises';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { failedJobFields, jobFields, type ProcessedJob } from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import {
  MAINTENANCE_JOBS,
  type MaintenanceJobName,
  maintenanceJobNameSchema,
  pingJobSchema,
} from './maintenance.jobs.js';

type MaintenanceHandler = (job: ProcessedJob) => Promise<unknown>;

const requestIdSchema = pingJobSchema.pick({ requestId: true });

@Processor(QUEUES.maintenance.name, { concurrency: QUEUES.maintenance.concurrency })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  private readonly handlers: Record<MaintenanceJobName, MaintenanceHandler> = {
    [MAINTENANCE_JOBS.ping]: (job) => this.ping(job),
    [MAINTENANCE_JOBS.outboxRelay]: () => this.outbox.relay(),
    [MAINTENANCE_JOBS.cleanup]: () => this.outbox.deletePublished(),
  };

  constructor(private readonly outbox: OutboxRelayService) {
    super();
  }

  async process(job: ProcessedJob): Promise<void> {
    const name = maintenanceJobNameSchema.safeParse(job.name);
    if (!name.success) {
      this.logger.error(jobFields(job), 'maintenance job unknown');
      throw new UnrecoverableError('maintenance job unknown');
    }
    await this.handlers[name.data](job);
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    const requestId = requestIdSchema.safeParse(job?.data).data?.requestId;
    this.logger.warn({ requestId, ...failedJobFields(job, error) }, 'job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn(
      { queue: QUEUES.maintenance.name, err: error.message },
      'worker connection error',
    );
  }

  private async ping(job: ProcessedJob): Promise<void> {
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
}
