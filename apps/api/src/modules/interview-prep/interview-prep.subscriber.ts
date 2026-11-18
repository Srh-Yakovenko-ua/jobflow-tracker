import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import {
  INTERVIEW_PREP_EVENTS,
  interviewPrepRequestedPayloadSchema,
} from './interview-prep.events.js';
import { InterviewPrepQueueService } from './interview-prep-queue.service.js';

@Injectable()
export class InterviewPrepSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly queue: InterviewPrepQueueService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: INTERVIEW_PREP_EVENTS.requested,
      schema: interviewPrepRequestedPayloadSchema,
      label: 'interview prep event',
      handle: (requested, delivery) => this.queue.enqueue(requested, delivery),
    });
  }
}
