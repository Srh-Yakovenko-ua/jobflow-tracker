import { Module } from '@nestjs/common';

import { Clock } from '../common/clock.js';
import { DomainEventRouter } from './domain-event-router.js';
import { DomainEventsProcessor } from './domain-events.processor.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxRelayService } from './outbox-relay.service.js';

@Module({
  providers: [
    OutboxRepository,
    OutboxRelayService,
    DomainEventRouter,
    DomainEventsProcessor,
    Clock,
  ],
  exports: [OutboxRelayService, DomainEventRouter],
})
export class OutboxWorkerModule {}
