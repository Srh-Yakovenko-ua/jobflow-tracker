import {
  type MarkNotificationsReadInput,
  type MarkNotificationsReadResponse,
  type Notification,
  type NotificationListQuery,
  type NotificationListResponse,
  notificationSchema,
  silenceItemSchema,
  silenceNotificationPayloadSchema,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type NotificationRow, NotificationsRepository } from './notifications.repository.js';

type ContentOf<Row> = Row extends Notification ? Pick<Row, 'type' | 'payload'> : never;

export type NewNotification = ContentOf<Notification>;

export type RecordNotification = NewNotification & InTransaction;

export type OnceNotification = Extract<
  NewNotification,
  { type: 'ai_done' | 'ai_failed' | 'insight_unlocked' }
>;

const aiJobIdOf = ({ payload }: OnceNotification) =>
  'aiJobId' in payload ? { aiJobId: payload.aiJobId } : {};

const storedSilencePayloadSchema = z.union([
  silenceNotificationPayloadSchema,
  silenceItemSchema.transform((item) => ({ items: [item] })),
]);

const payloadOf = ({ type, payload }: Pick<NotificationRow, 'type' | 'payload'>) =>
  type === 'silence' ? storedSilencePayloadSchema.parse(payload) : payload;

function toNotification({ readAt, createdAt, ...row }: NotificationRow): Notification {
  return notificationSchema.parse({
    ...row,
    payload: payloadOf(row),
    readAt: readAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
  });
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly repository: NotificationsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(userId: string, query: NotificationListQuery): Promise<NotificationListResponse> {
    const rows = await this.repository.list(userId, query);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(toNotification),
      nextCursor: rows.length > query.limit && last !== undefined ? last.id : null,
    };
  }

  async markRead(
    userId: string,
    input: MarkNotificationsReadInput,
  ): Promise<MarkNotificationsReadResponse> {
    const ids = 'ids' in input ? { ids: input.ids } : {};
    await this.repository.markRead(userId, { ...ids, now: this.clock.now() });
    return { unread: await this.repository.countUnread(userId) };
  }

  async record(userId: string, { tx, ...notification }: RecordNotification): Promise<void> {
    const write = (client: Prisma.TransactionClient) =>
      this.repository.insert(userId, { ...notification, tx: client });
    await (tx === undefined ? this.prisma.$transaction(write) : write(tx));
  }

  async recordOnce(userId: string, notification: OnceNotification): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const known = { type: notification.type, ...aiJobIdOf(notification), tx };
      if (!(await this.repository.exists(userId, known))) {
        await this.repository.insert(userId, { ...notification, tx });
      }
    });
  }
}
