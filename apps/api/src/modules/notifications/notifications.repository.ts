import type { NotificationListQuery, NotificationType } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { lockUser } from '../../prisma/lock-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { notificationCreatedEvent } from './notifications.events.js';

export type Transaction = { tx: Prisma.TransactionClient };

export type InsertNotification = Transaction & {
  type: NotificationType;
  payload: Prisma.InputJsonValue;
};

export type ExistingNotification = Transaction & { type: NotificationType; aiJobId?: string };

export type NotificationPage = Pick<NotificationListQuery, 'unread' | 'cursor' | 'limit'>;

export type MarkRead = { ids?: string[]; now: Date };

export const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof NOTIFICATION_SELECT }>;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(userId: string, { type, payload, tx }: InsertNotification): Promise<string> {
    const { id } = await tx.notification.create({
      data: { userId, type, payload },
      select: { id: true },
    });
    await tx.outboxEvent.create({
      data: notificationCreatedEvent(userId, { notificationId: id, type }),
      select: { id: true },
    });
    return id;
  }

  async lockUser(userId: string, { tx }: Transaction): Promise<void> {
    await lockUser(tx, userId);
  }

  async exists(userId: string, { type, aiJobId, tx }: ExistingNotification): Promise<boolean> {
    const found = await tx.notification.findFirst({
      where: {
        userId,
        type,
        ...(aiJobId !== undefined && { payload: { path: ['aiJobId'], equals: aiJobId } }),
      },
      select: { id: true },
    });
    return found !== null;
  }

  list(userId: string, { unread, cursor, limit }: NotificationPage): Promise<NotificationRow[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unread !== undefined && { readAt: unread ? null : { not: null } }),
        ...(cursor !== undefined && { id: { lt: cursor } }),
      },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: NOTIFICATION_SELECT,
    });
  }

  async markRead(userId: string, { ids, now }: MarkRead): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids !== undefined && { id: { in: ids } }) },
      data: { readAt: now },
    });
    return count;
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  countApplications(userId: string): Promise<number> {
    return this.prisma.application.count({ where: { userId, deletedAt: null, isDraft: false } });
  }
}
