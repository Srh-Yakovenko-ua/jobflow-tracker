import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { AiJobRouter } from '../ai/index.js';
import { APPLICATION_EVENTS } from '../applications/index.js';
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
    this.events.subscribe(APPLICATION_EVENTS.captureRequested, (event) =>
      this.queue.enqueue(event),
    );
    this.aiJobs.subscribe('vacancy_parse', (settled) => this.parse.settle(settled));
  }
}
