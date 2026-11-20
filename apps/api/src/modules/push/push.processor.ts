import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import {
  failedJobFields,
  parsedJob,
  type ProcessedJob,
  warnWorkerError,
} from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import { PUSH_JOBS, pushSendJobSchema } from './push-jobs.js';
import { PushSendService } from './push-send.service.js';
import type { PushOutcome } from './push-sender.js';

@Processor(QUEUES.push.name, { concurrency: QUEUES.push.concurrency })
export class PushProcessor extends WorkerHost {
  private readonly logger = new Logger(PushProcessor.name);

  constructor(private readonly push: PushSendService) {
    super();
  }

  async process(job: ProcessedJob): Promise<PushOutcome[]> {
    const pushed = parsedJob(job, {
      name: PUSH_JOBS.send,
      schema: pushSendJobSchema,
      logger: this.logger,
      label: 'push send',
    });
    return await this.push.send(pushed);
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    this.logger.warn(failedJobFields(job, error), 'push send failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    warnWorkerError(this.logger, { queue: QUEUES.push.name, error });
  }
}
