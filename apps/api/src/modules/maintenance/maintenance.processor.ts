import { setTimeout as delay } from 'node:timers/promises';

import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import {
  failedJobFields,
  jobFields,
  type ProcessedJob,
  warnWorkerError,
} from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import { ScheduledJobsService } from '../../scheduled-jobs/scheduled-jobs.service.js';
import { SummaryRequestsService } from '../summaries/index.js';
import {
  MAINTENANCE_JOBS,
  type MaintenanceJobName,
  maintenanceJobNameSchema,
  pingJobSchema,
} from './maintenance.jobs.js';

type MaintenanceHandler = (job: ProcessedJob) => Promise<unknown>;

const requestIdSchema = pingJobSchema.pick({ requestId: true });

const requestIdOf = (job: ProcessedJob | undefined) =>
  requestIdSchema.safeParse(job?.data).data?.requestId;

@Processor(QUEUES.maintenance.name, { concurrency: QUEUES.maintenance.concurrency })
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  private readonly handlers: Record<MaintenanceJobName, MaintenanceHandler> = {
    [MAINTENANCE_JOBS.ping]: (job) => this.ping(job),
    [MAINTENANCE_JOBS.outboxRelay]: () => this.outbox.relay(),
    [MAINTENANCE_JOBS.cleanup]: () => this.cleanup(),
    [MAINTENANCE_JOBS.aiJobsSweep]: () => this.scheduledJobs.sweepStaleAiJobs(),
    [MAINTENANCE_JOBS.monthlySummaryPick]: async () =>
      this.summaries.requestScheduledFor(await this.scheduledJobs.monthlySummaryUsers()),
    [MAINTENANCE_JOBS.silenceScan]: (job) => this.ran(job, () => this.scheduledJobs.silenceScan()),
    [MAINTENANCE_JOBS.autoGhostScan]: (job) => this.ran(job),
    [MAINTENANCE_JOBS.eventRemindersScan]: (job) =>
      this.ran(job, () => this.scheduledJobs.interviewReminders()),
  };

  constructor(
    private readonly outbox: OutboxRelayService,
    private readonly scheduledJobs: ScheduledJobsService,
    private readonly summaries: SummaryRequestsService,
  ) {
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
    this.logger.warn({ requestId: requestIdOf(job), ...failedJobFields(job, error) }, 'job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    warnWorkerError(this.logger, { queue: QUEUES.maintenance.name, error });
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

  private async cleanup(): Promise<void> {
    await this.outbox.deletePublished();
    await this.scheduledJobs.cleanup();
  }

  private async ran(
    job: ProcessedJob,
    step: () => Promise<unknown> = () => Promise.resolve(),
  ): Promise<void> {
    await step();
    this.logger.log({ requestId: requestIdOf(job), ...jobFields(job) }, 'scheduled job ran');
  }
}
