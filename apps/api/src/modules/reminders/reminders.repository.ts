import { OPEN_STAGES, type ReminderStatus, type ReminderType } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
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

const REMINDER_SELECT = {
  ...FOLLOWUP_SELECT,
  type: true,
  scheduledEventId: true,
} satisfies Prisma.ReminderSelect;

export type FollowupRow = Prisma.ReminderGetPayload<{ select: typeof FOLLOWUP_SELECT }>;

export type ReminderRow = Prisma.ReminderGetPayload<{ select: typeof REMINDER_SELECT }>;

export type InterviewOfApplication = InTransaction & {
  applicationId: string;
  scheduledEventId: string;
};

export type InterviewReminderOutcome = Extract<ReminderStatus, 'done' | 'dismissed'>;

export type CloseInterviewReminder = InterviewOfApplication & { status: InterviewReminderOutcome };

export type InsertInterviewReminder = InterviewOfApplication & { dueAt: Date };

export type CloseFollowups = InTransaction & {
  applicationId: string;
  status: InterviewReminderOutcome;
};

export type InsertFollowup = InTransaction & { applicationId: string; dueAt: Date };

export type CloseReminder = {
  id: string;
  status: Exclude<ReminderStatus, 'pending'>;
  snoozedUntil?: Date;
};

export type DateRange = { from: Date; to: Date };

type CloseActiveOfType = InTransaction & {
  where: { applicationId: string; type: ReminderType; scheduledEventId?: string };
  status: InterviewReminderOutcome;
};

const openApplicationOf = (userId: string) =>
  ({
    userId,
    deletedAt: null,
    currentStage: { in: [...OPEN_STAGES] },
  }) satisfies Prisma.ApplicationWhereInput;

@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  closeActiveInterview(
    userId: string,
    { applicationId, scheduledEventId, status, tx }: CloseInterviewReminder,
  ): Promise<number> {
    const where = { applicationId, scheduledEventId, type: 'interview_soon' as const };
    return this.closeActiveOfType(userId, { where, status, ...(tx && { tx }) });
  }

  closeActiveFollowups(
    userId: string,
    { applicationId, status, tx }: CloseFollowups,
  ): Promise<number> {
    const where = { applicationId, type: 'followup' as const };
    return this.closeActiveOfType(userId, { where, status, ...(tx && { tx }) });
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

  async insertFollowup(
    userId: string,
    { applicationId, dueAt, tx = this.prisma }: InsertFollowup,
  ): Promise<void> {
    await tx.reminder.create({
      data: { userId, applicationId, type: 'followup', dueAt },
      select: { id: true },
    });
  }

  findFollowups(userId: string, { from, to }: DateRange): Promise<FollowupRow[]> {
    const within = { gte: from, lt: to };
    return this.prisma.reminder.findMany({
      where: {
        userId,
        type: 'followup',
        application: openApplicationOf(userId),
        OR: [
          { status: 'pending', dueAt: within },
          { status: 'snoozed', snoozedUntil: within },
        ],
      },
      select: FOLLOWUP_SELECT,
    });
  }

  findActive(userId: string): Promise<ReminderRow[]> {
    return this.prisma.reminder.findMany({
      where: {
        userId,
        status: { in: ACTIVE_STATUSES },
        application: { ...openApplicationOf(userId), isDraft: false },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      select: REMINDER_SELECT,
    });
  }

  async closeActive(
    userId: string,
    { id, status, snoozedUntil }: CloseReminder,
  ): Promise<ReminderRow | undefined> {
    const [closed] = await this.prisma.reminder.updateManyAndReturn({
      where: { id, userId, status: { in: ACTIVE_STATUSES }, application: { deletedAt: null } },
      data: { status, ...(snoozedUntil && { snoozedUntil }) },
      select: REMINDER_SELECT,
    });
    return closed;
  }

  findOwnedStatus(userId: string, id: string): Promise<{ status: ReminderStatus } | null> {
    return this.prisma.reminder.findFirst({
      where: { id, userId, application: { deletedAt: null } },
      select: { status: true },
    });
  }

  private async closeActiveOfType(
    userId: string,
    { where, status, tx = this.prisma }: CloseActiveOfType,
  ): Promise<number> {
    const { count } = await tx.reminder.updateMany({
      where: { ...where, userId, status: { in: ACTIVE_STATUSES } },
      data: { status },
    });
    return count;
  }
}
