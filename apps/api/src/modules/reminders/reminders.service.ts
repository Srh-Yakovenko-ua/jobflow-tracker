import {
  type Reminder,
  type ReminderListResponse,
  type SilenceItem,
  type SnoozeReminderInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { addMilliseconds, milliseconds } from 'date-fns';

import { conflict, notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineService } from '../events/index.js';
import { nextInterviewReminderAt } from './interview-reminders.js';
import {
  type CloseInterviewReminder,
  type CloseReminder,
  type DateRange,
  type FollowupRow,
  type InterviewOfApplication,
  type ReminderRow,
  RemindersRepository,
} from './reminders.repository.js';

const REMINDER_NOT_FOUND = 'Reminder not found';

function toReminder({ application, dueAt, snoozedUntil, ...row }: ReminderRow): Reminder {
  return {
    ...row,
    company: application.company,
    stage: application.currentStage,
    dueAt: dueAt.toISOString(),
    snoozedUntil: snoozedUntil?.toISOString() ?? null,
  };
}

export type PlanInterview = InterviewOfApplication & { startsAt: Date; now: Date };

export type SnoozeReminder = SnoozeReminderInput & { id: string };

export type StartFollowup = Omit<SilenceItem, 'company'> & { now: Date };

@Injectable()
export class RemindersService {
  constructor(
    private readonly repository: RemindersRepository,
    private readonly timeline: TimelineService,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<ReminderListResponse> {
    const rows = await this.repository.findActive(userId);
    return { items: rows.map(toReminder) };
  }

  done(userId: string, id: string): Promise<Reminder> {
    return this.close(userId, { id, status: 'done' });
  }

  dismiss(userId: string, id: string): Promise<Reminder> {
    return this.close(userId, { id, status: 'dismissed' });
  }

  snooze(userId: string, { id, days }: SnoozeReminder): Promise<Reminder> {
    const snoozedUntil = addMilliseconds(this.clock.now(), milliseconds({ days }));
    return this.close(userId, { id, status: 'snoozed', snoozedUntil });
  }

  resolveFollowups(userId: string, applicationId: string): Promise<number> {
    return this.repository.closeActiveFollowups(userId, { applicationId, status: 'done' });
  }

  async startFollowup(userId: string, { applicationId, days, now }: StartFollowup): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.repository.insertFollowup(userId, { applicationId, dueAt: now, tx });
      await this.timeline.record(userId, {
        applicationId,
        kind: 'silence_started',
        payload: { silenceDays: days },
        occurredAt: now,
        tx,
      });
    });
  }

  async planInterview(userId: string, { startsAt, now, ...interview }: PlanInterview) {
    await this.repository.closeActiveInterview(userId, { ...interview, status: 'dismissed' });
    const dueAt = nextInterviewReminderAt(startsAt, now);
    if (dueAt !== null) {
      await this.repository.insertInterview(userId, { ...interview, dueAt });
    }
  }

  async closeInterview(userId: string, interview: CloseInterviewReminder): Promise<void> {
    await this.repository.closeActiveInterview(userId, interview);
  }

  followupsBetween(userId: string, range: DateRange): Promise<FollowupRow[]> {
    return this.repository.findFollowups(userId, range);
  }

  private async close(userId: string, change: CloseReminder): Promise<Reminder> {
    const closed = await this.repository.closeActive(userId, change);
    if (closed !== undefined) {
      return toReminder(closed);
    }
    const owned = await this.repository.findOwnedStatus(userId, change.id);
    throw owned === null ? notFound(REMINDER_NOT_FOUND) : conflict('Reminder is already closed');
  }
}
