import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { z } from 'zod';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import {
  APPLICATION_EVENTS,
  applicationCreatedPayloadSchema,
  applicationUpdatedPayloadSchema,
} from '../applications/index.js';
import {
  RESUME_EVENTS,
  resumeAttachedPayloadSchema,
  resumeVersionProfiledPayloadSchema,
} from '../resumes/index.js';
import { MatchTriggerService } from './match-trigger.service.js';

export const MATCH_TRIGGER_FIELDS: readonly string[] = ['position', 'stack', 'rawText', 'isDraft'];

const TRIGGER_LABEL = 'match trigger event';

type ApplicationUpdated = z.infer<typeof applicationUpdatedPayloadSchema>;

@Injectable()
export class MatchTriggerSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly triggers: MatchTriggerService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.created,
      schema: applicationCreatedPayloadSchema,
      label: TRIGGER_LABEL,
      handle: ({ userId, applicationId }) => this.triggers.schedule(userId, [applicationId]),
    });
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.updated,
      schema: applicationUpdatedPayloadSchema,
      label: TRIGGER_LABEL,
      handle: (payload) => this.updated(payload),
    });
    this.events.subscribeParsed({
      type: RESUME_EVENTS.attached,
      schema: resumeAttachedPayloadSchema,
      label: TRIGGER_LABEL,
      handle: ({ userId, applicationId }) => this.triggers.schedule(userId, [applicationId]),
    });
    this.events.subscribeParsed({
      type: RESUME_EVENTS.versionProfiled,
      schema: resumeVersionProfiledPayloadSchema,
      label: TRIGGER_LABEL,
      handle: ({ userId, resumeVersionId }) =>
        this.triggers.rematchVersion(userId, resumeVersionId),
    });
  }

  private updated({ userId, applicationId, fields }: ApplicationUpdated): Promise<number> {
    const changesInput = fields.some((field) => MATCH_TRIGGER_FIELDS.includes(field));
    return changesInput ? this.triggers.schedule(userId, [applicationId]) : Promise.resolve(0);
  }
}
