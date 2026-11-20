import { Injectable, Logger } from '@nestjs/common';

import type { EventDelivery } from '../../outbox/domain-event-router.js';
import { AI_PAYLOAD_BUILDERS, type AiJobBuilder, AiJobQueue } from '../ai/index.js';
import {
  type ApplicationCaptureRequestedPayload,
  ApplicationDraftsService,
} from '../applications/index.js';

@Injectable()
export class CaptureQueueService {
  private readonly logger = new Logger(CaptureQueueService.name);

  constructor(
    private readonly drafts: ApplicationDraftsService,
    private readonly aiQueue: AiJobQueue,
  ) {}

  async enqueue(
    requested: ApplicationCaptureRequestedPayload,
    delivery: EventDelivery,
  ): Promise<void> {
    const { userId, applicationId, aiJobId, requestId } = requested;
    const rawText = await this.drafts.findRawText(userId, applicationId);
    if (rawText === null) {
      return;
    }
    const job: AiJobBuilder = {
      aiJobId,
      userId,
      kind: 'vacancy_parse',
      buildInput: () => AI_PAYLOAD_BUILDERS.vacancy_parse({ rawText }),
      applicationId,
      requestId,
    };
    await this.aiQueue.queueOrFail(job, delivery);
    this.logger.log({ requestId, eventId: delivery.eventId, aiJobId }, 'capture parse queued');
  }
}
