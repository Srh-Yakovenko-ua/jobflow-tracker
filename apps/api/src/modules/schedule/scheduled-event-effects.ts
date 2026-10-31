import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { TimelineService } from '../events/index.js';
import { type InterviewReminderOutcome, RemindersService } from '../reminders/index.js';
import {
  type ChangeEffect,
  changeEffectOf,
  interviewDoneAt,
  type ScheduledEventSlot,
} from './scheduled-event-rules.js';
import type { ScheduledEventRow } from './scheduled-events.repository.js';

export type EventWrite = { event: ScheduledEventRow; now: Date; tx: Prisma.TransactionClient };

export type ChangeWrite = EventWrite & { before: ScheduledEventSlot };

type CloseWrite = { write: EventWrite; status: InterviewReminderOutcome };

const interviewOf = ({ id, applicationId }: ScheduledEventRow) => ({
  applicationId,
  scheduledEventId: id,
});

@Injectable()
export class ScheduledEventEffects {
  constructor(
    private readonly timeline: TimelineService,
    private readonly reminders: RemindersService,
  ) {}

  async scheduled(userId: string, write: EventWrite): Promise<void> {
    const { event, now, tx } = write;
    await this.timeline.record(userId, {
      applicationId: event.applicationId,
      kind: 'interview_scheduled',
      payload: { kind: event.kind, startsAt: event.startsAt.toISOString() },
      occurredAt: now,
      tx,
    });
    await this.plan(userId, write);
  }

  async changed(userId: string, { before, ...write }: ChangeWrite): Promise<ChangeEffect> {
    const effect = changeEffectOf(before, write.event);
    switch (effect) {
      case 'completed':
        await this.completed(userId, write);
        break;
      case 'cancelled':
        await this.close(userId, { write, status: 'dismissed' });
        break;
      case 'replanned':
        await this.plan(userId, write);
        break;
      case 'none':
        break;
      default: {
        const unhandled: never = effect;
        throw new Error(`Unhandled scheduled event effect ${String(unhandled)}`);
      }
    }
    return effect;
  }

  private async completed(userId: string, write: EventWrite): Promise<void> {
    const { event, now, tx } = write;
    await this.timeline.record(userId, {
      applicationId: event.applicationId,
      kind: 'interview_done',
      payload: { kind: event.kind, durationMin: event.durationMin },
      occurredAt: interviewDoneAt(event, now),
      tx,
    });
    await this.close(userId, { write, status: 'done' });
  }

  private plan(userId: string, { event, now, tx }: EventWrite): Promise<void> {
    return this.reminders.planInterview(userId, {
      ...interviewOf(event),
      startsAt: event.startsAt,
      now,
      tx,
    });
  }

  private close(userId: string, { write, status }: CloseWrite): Promise<void> {
    return this.reminders.closeInterview(userId, {
      ...interviewOf(write.event),
      status,
      tx: write.tx,
    });
  }
}
