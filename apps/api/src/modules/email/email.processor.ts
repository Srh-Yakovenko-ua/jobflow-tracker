import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import {
  failedJobFields,
  parsedJob,
  type ProcessedJob,
  warnWorkerError,
} from '../../queues/processed-job.js';
import { QUEUES } from '../../queues/queues.js';
import { EMAIL_JOBS, emailSendJobSchema } from './email-jobs.js';
import { type EmailOutcome, EmailSendService } from './email-send.service.js';

@Processor(QUEUES.notifications.name, { concurrency: QUEUES.notifications.concurrency })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly email: EmailSendService) {
    super();
  }

  async process(job: ProcessedJob): Promise<EmailOutcome> {
    const emailed = parsedJob(job, {
      name: EMAIL_JOBS.send,
      schema: emailSendJobSchema,
      logger: this.logger,
      label: 'email send',
    });
    return await this.email.send(emailed);
  }

  @OnWorkerEvent('failed')
  onFailed(job: ProcessedJob | undefined, error: Error): void {
    this.logger.warn(failedJobFields(job, error), 'email send failed');
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    warnWorkerError(this.logger, { queue: QUEUES.notifications.name, error });
  }
}
