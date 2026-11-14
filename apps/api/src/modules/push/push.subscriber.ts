import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { NOTIFICATION_EVENTS, notificationCreatedPayloadSchema } from '../notifications/index.js';
import { PushDeliveryService } from './push-delivery.service.js';
import { PushSender } from './push-sender.js';

@Injectable()
export class PushSubscriber implements OnModuleInit {
  private readonly logger = new Logger(PushSubscriber.name);

  constructor(
    private readonly events: DomainEventRouter,
    private readonly sender: PushSender,
    private readonly delivery: PushDeliveryService,
  ) {}

  onModuleInit(): void {
    if (!this.sender.enabled) {
      this.logger.log('push off: VAPID keys are not set');
      return;
    }
    this.events.subscribeParsed({
      type: NOTIFICATION_EVENTS.created,
      schema: notificationCreatedPayloadSchema,
      label: 'push event',
      handle: (payload) => this.delivery.schedule(payload),
    });
  }
}
