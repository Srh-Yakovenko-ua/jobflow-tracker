import { Injectable, Logger } from '@nestjs/common';

import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { type AiJobBuilder, AiJobQueue } from '../ai/index.js';
import type { CvHintsRequestedPayload } from './cv-hints.events.js';

@Injectable()
export class CvHintsQueueService {
  private readonly logger = new Logger(CvHintsQueueService.name);

  constructor(private readonly aiQueue: AiJobQueue) {}

  async enqueue(requested: CvHintsRequestedPayload, delivery: EventDelivery): Promise<void> {
    const { input, ...head } = requested;
    const job: AiJobBuilder = { kind: 'cv_hints', ...head, buildInput: () => input };
    await this.aiQueue.queueOrFail(job, delivery);
    const { aiJobId, applicationId, resumeVersionId, requestId } = requested;
    this.logger.log({ requestId, aiJobId, applicationId, resumeVersionId }, 'cv hints queued');
  }
}
