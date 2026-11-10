import { LIVE_EVENTS } from '@jobflow/shared';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

import { type DomainEvent, DomainEventRouter } from '../../outbox/domain-event-router.js';
import { LivePublisher } from '../live/index.js';
import { APPLICATION_EVENTS, applicationUpdatedPayloadSchema } from './applications.events.js';

@Injectable()
export class ApplicationLiveSubscriber implements OnModuleInit {
  private readonly logger = new Logger(ApplicationLiveSubscriber.name);

  constructor(
    private readonly events: DomainEventRouter,
    private readonly live: LivePublisher,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(APPLICATION_EVENTS.updated, (event) => this.forward(event));
  }

  private async forward({ id, payload }: DomainEvent): Promise<void> {
    const parsed = applicationUpdatedPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error({ eventId: id, issues: parsed.error.issues }, 'application event invalid');
      throw new UnrecoverableError('application event invalid');
    }
    const { userId, applicationId, fields } = parsed.data;
    await this.live.publish(userId, {
      type: LIVE_EVENTS.applicationUpdated,
      data: { applicationId, fields },
    });
  }
}
