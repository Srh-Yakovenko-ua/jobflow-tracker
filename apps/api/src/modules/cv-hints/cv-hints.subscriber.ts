import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { CV_HINTS_EVENTS, cvHintsRequestedPayloadSchema } from './cv-hints.events.js';
import { CvHintsQueueService } from './cv-hints-queue.service.js';

@Injectable()
export class CvHintsSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly queue: CvHintsQueueService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: CV_HINTS_EVENTS.requested,
      schema: cvHintsRequestedPayloadSchema,
      label: 'cv hints event',
      handle: (requested) => this.queue.enqueue(requested),
    });
  }
}
