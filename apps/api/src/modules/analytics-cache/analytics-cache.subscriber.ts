import { LIVE_EVENTS } from '@jobflow/shared';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { z } from 'zod';

import { errorMessageOf } from '../../common/error-message.js';
import { DomainEventRouter, type EventDelivery } from '../../outbox/domain-event-router.js';
import {
  APPLICATION_EVENTS,
  applicationCreatedPayloadSchema,
  applicationStageChangedPayloadSchema,
  applicationUpdatedPayloadSchema,
} from '../applications/index.js';
import { LivePublisher } from '../live/index.js';
import {
  RESUME_EVENTS,
  resumeAttachedPayloadSchema,
  resumeVersionUpdatedPayloadSchema,
} from '../resumes/index.js';
import { SEARCH_EVENTS, searchFinishedPayloadSchema } from '../searches/index.js';
import { SETTINGS_EVENTS, settingsChangedPayloadSchema } from '../settings/index.js';
import { AnalyticsCacheService } from './analytics-cache.service.js';

type UserEvent = { type: string; schema: z.ZodType<{ userId: string }> };

const INVALIDATING_EVENTS: readonly UserEvent[] = [
  { type: APPLICATION_EVENTS.created, schema: applicationCreatedPayloadSchema },
  { type: APPLICATION_EVENTS.updated, schema: applicationUpdatedPayloadSchema },
  { type: APPLICATION_EVENTS.stageChanged, schema: applicationStageChangedPayloadSchema },
  { type: RESUME_EVENTS.attached, schema: resumeAttachedPayloadSchema },
  { type: RESUME_EVENTS.versionUpdated, schema: resumeVersionUpdatedPayloadSchema },
  { type: SEARCH_EVENTS.finished, schema: searchFinishedPayloadSchema },
  { type: SETTINGS_EVENTS.changed, schema: settingsChangedPayloadSchema },
];

@Injectable()
export class AnalyticsCacheSubscriber implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsCacheSubscriber.name);

  constructor(
    private readonly events: DomainEventRouter,
    private readonly cache: AnalyticsCacheService,
    private readonly live: LivePublisher,
  ) {}

  onModuleInit(): void {
    for (const { type, schema } of INVALIDATING_EVENTS) {
      this.events.subscribeParsed({
        type,
        schema,
        label: 'analytics cache event',
        handle: ({ userId }, delivery) => this.invalidate(userId, delivery),
      });
    }
  }

  private async invalidate(userId: string, { eventId, finalAttempt }: EventDelivery) {
    try {
      await this.cache.invalidate(userId);
    } catch (error) {
      if (!finalAttempt) {
        throw error;
      }
      const err = errorMessageOf(error);
      this.logger.warn({ eventId, userId, err }, 'analytics cache not invalidated');
      return;
    }
    await this.live.publish(userId, { type: LIVE_EVENTS.analyticsChanged, data: {} });
  }
}
