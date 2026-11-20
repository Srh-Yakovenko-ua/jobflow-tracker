import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { AiJobRouter } from '../ai/index.js';
import {
  APPLICATION_EVENTS,
  applicationCaptureRequestedPayloadSchema,
} from '../applications/index.js';
import { CaptureParseService } from './capture-parse.service.js';
import { CaptureQueueService } from './capture-queue.service.js';

@Injectable()
export class CaptureSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly aiJobs: AiJobRouter,
    private readonly queue: CaptureQueueService,
    private readonly parse: CaptureParseService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.captureRequested,
      schema: applicationCaptureRequestedPayloadSchema,
      label: 'capture event',
      handle: (requested, delivery) => this.queue.enqueue(requested, delivery),
    });
    this.aiJobs.subscribe('vacancy_parse', (settled) => this.parse.settle(settled));
  }
}
