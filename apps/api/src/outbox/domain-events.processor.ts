import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { z } from 'zod';

import { failedJobFields, jobFields, type ProcessedJob } from '../queues/processed-job.js';
import { QUEUES } from '../queues/queues.js';
import { DomainEventRouter } from './domain-event-router.js';

const domainEventJobSchema = z.object({ id: z.uuid(), name: z.string().min(1) });

@Processor(QUEUES.domainEvents.name, { concurrency: QUEUES.domainEvents.concurrency })
export class DomainEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(DomainEventsProcessor.name);

  constructor(private readonly router: DomainEventRouter) {
    super();
  }

  async process(job: ProcessedJob): Promise<void> {
    const parsed = domainEventJobSchema.safeParse({ id: job.id, name: job.name });
    if (!parsed.success) {
      this.logger.error(
        { ...jobFields(job), issues: parsed.error.issues },
        'domain event job invalid',
      );
      throw new UnrecoverableError('domain event job invalid');
    }
    const { id, name } = parsed.data;
    const handlers = await this.router.route({ id, type: name, payload: job.data });
    this.logger.log({ ...jobFields(job), handlers }, 'domain event routed');
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    this.logger.warn(failedJobFields(job, error), 'job failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    this.logger.warn(
      { queue: QUEUES.domainEvents.name, err: error.message },
      'worker connection error',
    );
  }
}
