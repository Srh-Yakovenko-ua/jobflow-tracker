import { LIVE_EVENTS } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { LivePublisher } from '../live/index.js';
import {
  NOTIFICATION_EVENTS,
  type NotificationCreatedPayload,
  notificationCreatedPayloadSchema,
} from './notifications.events.js';

@Injectable()
export class NotificationsSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly live: LivePublisher,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: NOTIFICATION_EVENTS.created,
      schema: notificationCreatedPayloadSchema,
      label: 'notification event',
      handle: (payload) => this.deliver(payload),
    });
  }

  private deliver({ userId, notificationId }: NotificationCreatedPayload): Promise<void> {
    return this.live.publish(userId, {
      type: LIVE_EVENTS.notificationCreated,
      data: { notificationId },
    });
  }
}
