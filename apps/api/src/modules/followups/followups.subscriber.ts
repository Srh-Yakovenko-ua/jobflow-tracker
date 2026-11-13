import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { FollowupQueueService } from './followup-queue.service.js';
import { FOLLOWUP_EVENTS, followupRequestedPayloadSchema } from './followups.events.js';

@Injectable()
export class FollowupsSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly queue: FollowupQueueService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: FOLLOWUP_EVENTS.requested,
      schema: followupRequestedPayloadSchema,
      label: 'followup event',
      handle: (requested) => this.queue.enqueue(requested),
    });
  }
}
