import { OPEN_STAGES, type Stage } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { differenceInMinutes } from 'date-fns';

import { PrismaService } from '../../prisma/prisma.service.js';
import {
  type DueInterviewRow,
  type InterviewAlertChange,
  InterviewAlertsRepository,
} from './interview-alerts.repository.js';
import { nextInterviewReminderAt } from './interview-reminders.js';
import { type NewNotification, RemindersRepository } from './reminders.repository.js';

type DueInterview = { row: DueInterviewRow; now: Date };

type Settlement = { next: InterviewAlertChange; alert?: NewNotification };

const OPEN: readonly Stage[] = OPEN_STAGES;

const isOpen = ({ currentStage, deletedAt }: DueInterviewRow['application']) =>
  deletedAt === null && OPEN.includes(currentStage);

function settlementOf({ row, now }: DueInterview): Settlement {
  const { scheduledEvent: event, application } = row;
  if (event === null || event.status !== 'planned' || !isOpen(application)) {
    return { next: { status: 'dismissed' } };
  }
  if (event.startsAt <= now) {
    return { next: { status: 'done' } };
  }
  const dueAt = nextInterviewReminderAt(event.startsAt, now);
  const payload = {
    applicationId: row.applicationId,
    scheduledEventId: event.id,
    company: application.company,
    startsAt: event.startsAt.toISOString(),
    minutesBefore: differenceInMinutes(event.startsAt, now, { roundingMethod: 'ceil' }),
  };
  return {
    next: dueAt === null ? { status: 'done' } : { dueAt },
    alert: { type: 'interview_soon', payload },
  };
}

@Injectable()
export class InterviewAlertsService {
  constructor(
    private readonly alerts: InterviewAlertsRepository,
    private readonly reminders: RemindersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async fireDue(userId: string, now: Date): Promise<number> {
    const rows = await this.alerts.findDueInterviews(userId, now);
    let alerted = 0;
    for (const row of rows) {
      alerted += (await this.settle(userId, { row, now })) ? 1 : 0;
    }
    return alerted;
  }

  private settle(userId: string, due: DueInterview): Promise<boolean> {
    const { next, alert } = settlementOf(due);
    const { id, dueAt } = due.row;
    return this.prisma.$transaction(async (tx) => {
      const count = await this.alerts.rearmInterview(userId, { id, dueAt, next, tx });
      if (count === 0 || alert === undefined) {
        return false;
      }
      await this.reminders.insertNotification(userId, { ...alert, tx });
      return true;
    });
  }
}
