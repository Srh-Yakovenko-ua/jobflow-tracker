import type { Notification, SilenceItem, SilenceNotificationPayload } from '@jobflow/shared';
import type { OnModuleInit, Provider, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { Prisma } from '../generated/prisma/client.js';
import { AiJobRouter, type SettledAiJob } from '../modules/ai/index.js';
import {
  type NewNotification,
  NotificationsService,
  onceKeyOf,
  type OnceNotification,
  type RecordNotification,
  type VacancyParseRead,
} from '../modules/notifications/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AI_JOB_ID } from './ai.js';
import type { ByUser } from './recorded-events.js';
import { APPLICATION_ID, SCHEDULED_EVENT_ID } from './service-fixtures.js';
import { NOW } from './time.js';

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

export const NOTIFICATION_ID = '0199f0a0-0000-7000-8000-000000000301';

export const notificationOf = (content: NewNotification): Notification => ({
  id: NOTIFICATION_ID,
  readAt: null,
  createdAt: NOW.toISOString(),
  ...content,
});

export const SILENCE_NOTIFICATION = notificationOf({ type: 'silence', payload: SILENCE_PAYLOAD });

export const interviewSoonAt = (startsAt: Date): Notification =>
  notificationOf({
    type: 'interview_soon',
    payload: {
      applicationId: APPLICATION_ID,
      scheduledEventId: SCHEDULED_EVENT_ID,
      company: 'Ромашка',
      startsAt: startsAt.toISOString(),
      minutesBefore: 60,
    },
  });

export const interviewPrepReadyFor = (startsAt: Date): Notification =>
  notificationOf({
    type: 'interview_prep_ready',
    payload: {
      aiJobId: AI_JOB_ID,
      applicationId: APPLICATION_ID,
      company: 'Acme',
      eventKind: 'tech_interview',
      startsAt: startsAt.toISOString(),
    },
  });

export const MONTHLY_SUMMARY_NOTIFICATION = notificationOf({
  type: 'monthly_summary_ready',
  payload: { aiJobId: AI_JOB_ID, month: '2026-09' },
});

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

export async function createNotificationRows(
  prisma: PrismaService,
  rows: Prisma.NotificationCreateManyInput[],
): Promise<string[]> {
  const created = await prisma.notification.createManyAndReturn({
    data: rows,
    select: { id: true },
  });
  return created.map(({ id }) => id);
}

export const readAtOf = (prisma: PrismaService, ids: string[]) =>
  prisma.notification.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
    select: { readAt: true },
  });

const sameAs = (notification: OnceNotification) => (recorded: RecordedNotification) =>
  recorded.type === notification.type && onceKeyOf(recorded)?.id === onceKeyOf(notification)?.id;

export class RecordingNotifications {
  readonly notifications: RecordedNotification[] = [];

  readonly vacancyParsesRead: ByUser<VacancyParseRead>[] = [];

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

  markVacancyParseRead(userId: string, read: VacancyParseRead): Promise<void> {
    this.vacancyParsesRead.push({ userId, ...read });
    return Promise.resolve();
  }
}

export async function settlingThrough(subscriber: Type<OnModuleInit>, providers: Provider[] = []) {
  const notifications = new RecordingNotifications();
  const moduleRef = await Test.createTestingModule({
    providers: [
      subscriber,
      AiJobRouter,
      { provide: NotificationsService, useValue: notifications },
      ...providers,
    ],
  }).compile();
  await moduleRef.init();
  const router = moduleRef.get(AiJobRouter);
  return { notifications, settle: (settled: SettledAiJob) => router.route(settled) };
}
