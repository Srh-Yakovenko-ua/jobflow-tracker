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
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineService } from '../events/index.js';
import { nextInterviewReminderAt } from './interview-reminders.js';
import {
  type CloseFollowups,
  type CloseInterviewReminder,
  type CloseReminder,
  type DateRange,
  type FollowupRow,
  type InterviewOfApplication,
  type ReminderRow,
  RemindersRepository,
} from './reminders.repository.js';
import { sameSilenceMark, type SilenceMark, silenceMarkOf } from './silence-mark.js';

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

export type ResolveFollowups = Omit<CloseFollowups, 'status'>;

type SilenceStart = Omit<SilenceItem, 'company'> & { now: Date };

export type StartFollowup = SilenceStart & { seen: SilenceMark };

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

  resolveFollowups(userId: string, followups: ResolveFollowups): Promise<number> {
    return this.repository.closeActiveFollowups(userId, { ...followups, status: 'done' });
  }

  startFollowup(userId: string, { seen, ...silence }: StartFollowup): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { applicationId } = silence;
      const current = await this.repository.findSilenceMark(userId, { applicationId, tx });
      if (current === null || !sameSilenceMark(seen, silenceMarkOf(current))) {
        return false;
      }
      await this.recordSilenceStart(userId, { ...silence, tx });
      return true;
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

  private async recordSilenceStart(
    userId: string,
    { applicationId, days, now, tx }: SilenceStart & { tx: Prisma.TransactionClient },
  ): Promise<void> {
    await this.repository.insertFollowup(userId, { applicationId, dueAt: now, tx });
    await this.timeline.record(userId, {
      applicationId,
      kind: 'silence_started',
      payload: { silenceDays: days },
      occurredAt: now,
      tx,
    });
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
