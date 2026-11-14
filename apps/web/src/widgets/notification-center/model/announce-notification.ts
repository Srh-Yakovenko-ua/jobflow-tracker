'use client';

import type { Notification } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { notificationListQueryOptions, notificationTargetOf } from '@/entities/notification';
import { meQueryOptions } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';
import { showToast, type ToastContent, type ToastTone } from '@/shared/ui/toast';

import { notificationCopyOf } from './notification-copy';

export type AnnounceNotificationInput = Readonly<{
  queryClient: QueryClient;
  notificationId: string;
  navigate: (href: string) => void;
}>;

const TOASTED: Partial<Record<Notification['type'], ToastTone>> = {
  interview_soon: 'info',
  ai_done: 'info',
  ai_failed: 'error',
};

type Announced = Readonly<{ notification: Notification; timeZone: string }>;

async function announcedOf({ queryClient, notificationId }: AnnounceNotificationInput) {
  const [page, me] = await Promise.all([
    queryClient.query(notificationListQueryOptions()),
    queryClient.query({ ...meQueryOptions(), staleTime: 'static' }),
  ]);
  const notification = page.items.find((item) => item.id === notificationId);
  if (notification === undefined || !me.settings.notifyInApp) return undefined;
  return { notification, timeZone: me.settings.timezone };
}

function toastOf(
  { notification, timeZone }: Announced,
  navigate: AnnounceNotificationInput['navigate'],
) {
  const tone = TOASTED[notification.type];
  if (tone === undefined) return undefined;
  const { title, text } = notificationCopyOf(notification, timeZone);
  const target = notificationTargetOf(notification);
  const content: ToastContent = { tone, title, description: text };
  if (target === null) return content;
  const onAction = () => {
    navigate(target);
  };
  return { ...content, action: { label: uk.notifications.open, onAction } };
}

export async function announceNotification(input: AnnounceNotificationInput): Promise<void> {
  try {
    const announced = await announcedOf(input);
    const content = announced && toastOf(announced, input.navigate);
    if (content) showToast(content, { id: input.notificationId });
  } catch (error) {
    logger.warn({ err: error, notificationId: input.notificationId }, 'notification toast skipped');
  }
}
