import { LIVE_EVENTS } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { LivePublisher } from '../live/index.js';
import {
  APPLICATION_EVENTS,
  type ApplicationUpdatedPayload,
  applicationUpdatedPayloadSchema,
} from './applications.events.js';

@Injectable()
export class ApplicationLiveSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly live: LivePublisher,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.updated,
      schema: applicationUpdatedPayloadSchema,
      label: 'application event',
      handle: (payload) => this.forward(payload),
    });
  }

  private forward({ userId, applicationId, fields }: ApplicationUpdatedPayload): Promise<void> {
    return this.live.publish(userId, {
      type: LIVE_EVENTS.applicationUpdated,
      data: { applicationId, fields },
    });
  }
}
