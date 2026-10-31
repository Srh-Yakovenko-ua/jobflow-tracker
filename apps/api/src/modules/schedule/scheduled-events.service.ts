import type {
  CreateScheduledEventInput,
  ScheduledEvent,
  ScheduledEventListResponse,
  ScheduledEventUpdateResponse,
  UpdateScheduledEventInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { withIsoTimestamps } from '../../common/iso-timestamps.js';
import { changedOrNotFound, owned } from '../../common/owned.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { icsOf } from './ics.js';
import { ScheduledEventEffects } from './scheduled-event-effects.js';
import { statusChangeAllowed, suggestedStageAfter } from './scheduled-event-rules.js';
import {
  type FindScheduledEvent,
  type OwnedScheduledEventRow,
  type ScheduledEventOfApplication,
  type ScheduledEventRow,
  type ScheduledEventsOfApplication,
  ScheduledEventsRepository,
} from './scheduled-events.repository.js';

const SCHEDULED_EVENT_NOT_FOUND = 'Scheduled event not found';

const CHANGED_MEANWHILE = 'The scheduled event changed meanwhile, reload it and try again';

export type CreateScheduledEvent = ScheduledEventsOfApplication & {
  input: CreateScheduledEventInput;
};

export type EditScheduledEvent = ScheduledEventOfApplication & { input: UpdateScheduledEventInput };

type Change = EditScheduledEvent & { now: Date; tx: Prisma.TransactionClient };

const toScheduledEvent = ({ startsAt, ...row }: ScheduledEventRow): ScheduledEvent => ({
  ...withIsoTimestamps(row),
  startsAt: startsAt.toISOString(),
});

@Injectable()
export class ScheduledEventsService {
  constructor(
    private readonly repository: ScheduledEventsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly effects: ScheduledEventEffects,
  ) {}

  async create(
    userId: string,
    { applicationId, input }: CreateScheduledEvent,
  ): Promise<ScheduledEvent> {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const event = owned(await this.repository.insert(userId, { applicationId, input, now, tx }));
      await this.effects.scheduled(userId, { event, now, tx });
      return event;
    });
    return toScheduledEvent(row);
  }

  async list(userId: string, applicationId: string): Promise<ScheduledEventListResponse> {
    const { scheduledEvents } = owned(
      await this.repository.findForApplication(userId, { applicationId }),
    );
    return { items: scheduledEvents.map(toScheduledEvent) };
  }

  update(userId: string, edit: EditScheduledEvent): Promise<ScheduledEventUpdateResponse> {
    const now = this.clock.now();
    return this.prisma.$transaction((tx) => this.change(userId, { ...edit, now, tx }));
  }

  async remove(userId: string, event: ScheduledEventOfApplication): Promise<void> {
    changedOrNotFound(await this.repository.deleteOwned(userId, event), SCHEDULED_EVENT_NOT_FOUND);
  }

  async ics(userId: string, target: ScheduledEventOfApplication): Promise<string> {
    const { application, ...event } = await this.ownedEvent(userId, target);
    return icsOf({ ...event, company: application.company }, this.clock.now());
  }

  private async change(userId: string, { input, now, tx, ...target }: Change) {
    const before = await this.ownedEvent(userId, { ...target, tx });
    const status = input.status ?? before.status;
    if (!statusChangeAllowed(before.status, status)) {
      throw conflict(`A ${before.status} scheduled event cannot become ${status}`);
    }
    const update = { ...target, input, expectedStatus: before.status, updatedAt: now, tx };
    if ((await this.repository.updateOwned(userId, update)) === 0) {
      throw conflict(CHANGED_MEANWHILE);
    }
    const { application, ...event } = await this.ownedEvent(userId, { ...target, tx });
    const effect = await this.effects.changed(userId, { before, event, now, tx });
    const suggestedStage =
      effect === 'completed' ? suggestedStageAfter(event.kind, application.currentStage) : null;
    return { ...toScheduledEvent(event), suggestedStage };
  }

  private async ownedEvent(
    userId: string,
    target: FindScheduledEvent,
  ): Promise<OwnedScheduledEventRow> {
    return owned(await this.repository.findOwned(userId, target), SCHEDULED_EVENT_NOT_FOUND);
  }
}
