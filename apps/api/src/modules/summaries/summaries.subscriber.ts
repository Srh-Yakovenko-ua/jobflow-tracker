import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { SUMMARY_EVENTS, summaryRequestedPayloadSchema } from './summaries.events.js';
import { SummaryQueueService } from './summary-queue.service.js';

@Injectable()
export class SummariesSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly queue: SummaryQueueService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: SUMMARY_EVENTS.requested,
      schema: summaryRequestedPayloadSchema,
      label: 'summary event',
      handle: (requested, delivery) => this.queue.enqueue(requested, delivery),
    });
  }
}
