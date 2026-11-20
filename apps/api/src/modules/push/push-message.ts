import {
  interviewPrepTitleOf,
  longestSilentItemOf,
  type Notification,
  notificationTargetOf,
  type NotificationType,
  type PushMessage,
  type SilenceItem,
  type SilenceNotificationPayload,
  userNow,
  type UserSettings,
} from '@jobflow/shared';
import { format } from 'date-fns';

import {
  FOLLOW_UP_HINT,
  NOTIFICATION_FALLBACK_PATH,
  silenceTitleOf,
  silentDaysOf,
  summaryReadyCopyOf,
} from '../notifications/index.js';

export const PUSHED_TYPES = [
  'silence',
  'interview_soon',
  'auto_ghosted',
  'monthly_summary_ready',
  'interview_prep_ready',
] as const satisfies readonly NotificationType[];

export type PushedType = (typeof PUSHED_TYPES)[number];

export type PushedNotification = Extract<Notification, { type: PushedType }>;

type PushText = Omit<PushMessage, 'url'>;

const PUSHED: ReadonlySet<NotificationType> = new Set(PUSHED_TYPES);

export const isPushedType = (type: NotificationType): type is PushedType => PUSHED.has(type);

export const isPushed = (notification: Notification): notification is PushedNotification =>
  isPushedType(notification.type);

const applicationTag = (applicationId: string) => `application:${applicationId}`;

function longestOf(payload: SilenceNotificationPayload): SilenceItem {
  const longest = longestSilentItemOf(payload);
  if (longest === undefined) throw new Error('a silence reminder holds no application');
  return longest;
}

function silenceText(payload: SilenceNotificationPayload): PushText {
  const longest = longestOf(payload);
  return {
    title: silenceTitleOf(longest),
    body: FOLLOW_UP_HINT,
    tag: applicationTag(longest.applicationId),
  };
}

export type PushDelivery = { settings: Pick<UserSettings, 'timezone'>; deliverAt: Date };

function textOf(notification: PushedNotification, { settings, deliverAt }: PushDelivery): PushText {
  switch (notification.type) {
    case 'silence':
      return silenceText(notification.payload);
    case 'interview_soon': {
      const { startsAt, company, applicationId } = notification.payload;
      const clock = format(userNow(settings, new Date(startsAt)), 'HH:mm');
      return { title: `Співбесіда о ${clock}`, body: company, tag: applicationTag(applicationId) };
    }
    case 'auto_ghosted': {
      const { items, autoGhostDays } = notification.payload;
      const companies = items.map(({ company }) => company).join(', ');
      const body = `${companies} · понад ${silentDaysOf(autoGhostDays)}`;
      return { title: 'Перенесено в ghosted', body, tag: 'auto-ghosted' };
    }
    case 'monthly_summary_ready': {
      const { month } = notification.payload;
      return { ...summaryReadyCopyOf(month), tag: `summary:${month}` };
    }
    case 'interview_prep_ready': {
      const { payload } = notification;
      const title = interviewPrepTitleOf({ payload, createdAt: deliverAt.toISOString() }, settings);
      const tag = `interview-prep:${payload.applicationId}`;
      return { title, body: 'Підготовка готова', tag };
    }
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled pushed notification: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function pushMessageOf(
  notification: PushedNotification,
  delivery: PushDelivery,
): PushMessage {
  return {
    ...textOf(notification, delivery),
    url: notificationTargetOf(notification) ?? NOTIFICATION_FALLBACK_PATH,
  };
}
