import type { SilenceItem, SilenceNotificationPayload } from '@jobflow/shared';
import type { OnModuleInit, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AiJobRouter, type SettledAiJob } from '../modules/ai/index.js';
import {
  type NewNotification,
  NotificationsService,
  type OnceNotification,
  type RecordNotification,
} from '../modules/notifications/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ByUser } from './recorded-events.js';
import { APPLICATION_ID } from './service-fixtures.js';

export type RecordedNotification = ByUser<RecordNotification>;

export type NewNotificationRows = { userId: string; readAt: (Date | null)[] };

export const NOTIFICATIONS_PATH = '/api/v1/notifications';

export const NOTIFICATIONS_READ_PATH = `${NOTIFICATIONS_PATH}/read`;

export const SILENCE_ITEM: SilenceItem = {
  applicationId: APPLICATION_ID,
  company: 'Ромашка',
  days: 7,
};

export const SILENCE_PAYLOAD: SilenceNotificationPayload = { items: [SILENCE_ITEM] };

export async function createNotifications(
  prisma: PrismaService,
  { userId, readAt }: NewNotificationRows,
): Promise<string[]> {
  const ids: string[] = [];
  for (const read of readAt) {
    const { id } = await prisma.notification.create({
      data: { userId, type: 'silence', payload: SILENCE_PAYLOAD, readAt: read },
      select: { id: true },
    });
    ids.push(id);
  }
  return ids;
}

const aiJobIdOf = ({ payload }: NewNotification) =>
  'aiJobId' in payload ? payload.aiJobId : undefined;

const sameAs = (notification: OnceNotification) => (recorded: RecordedNotification) =>
  recorded.type === notification.type && aiJobIdOf(recorded) === aiJobIdOf(notification);

export class RecordingNotifications {
  readonly notifications: RecordedNotification[] = [];

  record(userId: string, notification: RecordNotification): Promise<void> {
    this.notifications.push({ userId, ...notification });
    return Promise.resolve();
  }

  async recordOnce(userId: string, notification: OnceNotification): Promise<void> {
    const known = this.notifications.filter((recorded) => recorded.userId === userId);
    if (!known.some(sameAs(notification))) {
      await this.record(userId, notification);
    }
  }
}

export async function settlingThrough(subscriber: Type<OnModuleInit>) {
  const notifications = new RecordingNotifications();
  const moduleRef = await Test.createTestingModule({
    providers: [
      subscriber,
      AiJobRouter,
      { provide: NotificationsService, useValue: notifications },
    ],
  }).compile();
  await moduleRef.init();
  const router = moduleRef.get(AiJobRouter);
  return { notifications, settle: (settled: SettledAiJob) => router.route(settled) };
}
