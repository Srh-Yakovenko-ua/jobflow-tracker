import { THRESHOLDS } from '@jobflow/shared';
import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import {
  APPLICATION_EVENTS,
  applicationCreatedPayloadSchema,
  applicationUpdatedPayloadSchema,
} from '../applications/index.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

const LABEL = 'application event';

@Injectable()
export class InsightSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly repository: NotificationsRepository,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.created,
      schema: applicationCreatedPayloadSchema,
      label: LABEL,
      handle: ({ userId }) => this.unlock(userId),
    });
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.updated,
      schema: applicationUpdatedPayloadSchema,
      label: LABEL,
      handle: ({ userId, fields }) =>
        fields.includes('isDraft') ? this.unlock(userId) : Promise.resolve(),
    });
  }

  private async unlock(userId: string): Promise<void> {
    const applications = await this.repository.countApplications(userId);
    if (applications >= THRESHOLDS.MIN_N_INSIGHT) {
      await this.notifications.recordOnce(userId, {
        type: 'insight_unlocked',
        payload: { applications },
      });
    }
  }
}
