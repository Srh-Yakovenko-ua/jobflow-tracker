import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { InterviewReminderOutcome } from './reminders.repository.js';

const DUE_INTERVIEW_SELECT = {
  id: true,
  applicationId: true,
  scheduledEventId: true,
  dueAt: true,
  scheduledEvent: { select: { id: true, startsAt: true, status: true } },
  application: { select: { company: true, currentStage: true, deletedAt: true } },
} satisfies Prisma.ReminderSelect;

export type DueInterviewRow = Prisma.ReminderGetPayload<{ select: typeof DUE_INTERVIEW_SELECT }>;

export type InterviewAlertChange = { dueAt: Date } | { status: InterviewReminderOutcome };

export type RearmInterview = InTransaction & {
  id: string;
  dueAt: Date;
  next: InterviewAlertChange;
};

@Injectable()
export class InterviewAlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDueInterviews(userId: string, now: Date): Promise<DueInterviewRow[]> {
    return this.prisma.reminder.findMany({
      where: { userId, type: 'interview_soon', status: 'pending', dueAt: { lte: now } },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      select: DUE_INTERVIEW_SELECT,
    });
  }

  async rearmInterview(
    userId: string,
    { id, dueAt, next, tx = this.prisma }: RearmInterview,
  ): Promise<number> {
    const { count } = await tx.reminder.updateMany({
      where: { id, userId, type: 'interview_soon', status: 'pending', dueAt },
      data: next,
    });
    return count;
  }
}
