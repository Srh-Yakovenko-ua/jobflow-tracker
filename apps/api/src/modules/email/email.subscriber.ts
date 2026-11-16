import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { NOTIFICATION_EVENTS, notificationCreatedPayloadSchema } from '../notifications/index.js';
import { EmailDeliveryService } from './email-delivery.service.js';

@Injectable()
export class EmailSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly delivery: EmailDeliveryService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: NOTIFICATION_EVENTS.created,
      schema: notificationCreatedPayloadSchema,
      label: 'email event',
      handle: (payload) => this.delivery.schedule(payload),
    });
  }
}
