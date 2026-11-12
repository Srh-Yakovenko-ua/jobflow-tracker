import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import {
  failedJobFields,
  parsedJob,
  type ProcessedJob,
  warnWorkerError,
} from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import { MatchQueueService } from './match-queue.service.js';
import { MATCH_JOBS, matchTriggerJobSchema } from './match-trigger.service.js';

@Processor(QUEUES.match.name, { concurrency: QUEUES.match.concurrency })
export class MatchTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchTriggerProcessor.name);

  constructor(private readonly match: MatchQueueService) {
    super();
  }

  async process(job: ProcessedJob): Promise<string | null> {
    const { userId, applicationId } = parsedJob(job, {
      name: MATCH_JOBS.trigger,
      schema: matchTriggerJobSchema,
      logger: this.logger,
      label: 'match trigger',
    });
    return await this.match.request(userId, { applicationId });
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    this.logger.warn(failedJobFields(job, error), 'match trigger failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    warnWorkerError(this.logger, { queue: QUEUES.match.name, error });
  }
}
