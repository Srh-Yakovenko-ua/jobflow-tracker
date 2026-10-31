import type { ReminderStatus } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const ACTIVE_STATUSES: ReminderStatus[] = ['pending', 'snoozed'];

const FOLLOWUP_SELECT = {
  id: true,
  applicationId: true,
  status: true,
  dueAt: true,
  snoozedUntil: true,
  application: { select: { company: true, currentStage: true } },
} satisfies Prisma.ReminderSelect;

export type FollowupRow = Prisma.ReminderGetPayload<{ select: typeof FOLLOWUP_SELECT }>;

type InTransaction = { tx?: Prisma.TransactionClient };

export type InterviewOfApplication = InTransaction & {
  applicationId: string;
  scheduledEventId: string;
};

export type InterviewReminderOutcome = Extract<ReminderStatus, 'done' | 'dismissed'>;

export type CloseInterviewReminder = InterviewOfApplication & { status: InterviewReminderOutcome };

export type InsertInterviewReminder = InterviewOfApplication & { dueAt: Date };

export type DateRange = { from: Date; to: Date };

@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async closeActiveInterview(
    userId: string,
    { applicationId, scheduledEventId, status, tx = this.prisma }: CloseInterviewReminder,
  ): Promise<number> {
    const { count } = await tx.reminder.updateMany({
      where: {
        userId,
        applicationId,
        scheduledEventId,
        type: 'interview_soon',
        status: { in: ACTIVE_STATUSES },
      },
      data: { status },
    });
    return count;
  }

  async insertInterview(
    userId: string,
    { applicationId, scheduledEventId, dueAt, tx = this.prisma }: InsertInterviewReminder,
  ): Promise<void> {
    await tx.reminder.create({
      data: { userId, applicationId, scheduledEventId, type: 'interview_soon', dueAt },
      select: { id: true },
    });
  }

  findFollowups(userId: string, { from, to }: DateRange): Promise<FollowupRow[]> {
    const within = { gte: from, lt: to };
    return this.prisma.reminder.findMany({
      where: {
        userId,
        type: 'followup',
        application: { userId, deletedAt: null },
        OR: [
          { status: 'pending', dueAt: within },
          { status: 'snoozed', snoozedUntil: within },
        ],
      },
      select: FOLLOWUP_SELECT,
    });
  }
}
