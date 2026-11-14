import {
  countedUk,
  DAY_FORMS_UK,
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

import { monthNameOf } from '../../common/year-month.js';

export const PUSHED_TYPES = [
  'silence',
  'interview_soon',
  'auto_ghosted',
  'monthly_summary_ready',
] as const satisfies readonly NotificationType[];

export type PushedType = (typeof PUSHED_TYPES)[number];

export type PushedNotification = Extract<Notification, { type: PushedType }>;

type PushText = Omit<PushMessage, 'url'>;

const PUSHED: ReadonlySet<NotificationType> = new Set(PUSHED_TYPES);

const FALLBACK_URL = '/notifications';

export const isPushedType = (type: NotificationType): type is PushedType => PUSHED.has(type);

export const isPushed = (notification: Notification): notification is PushedNotification =>
  isPushedType(notification.type);

const applicationTag = (applicationId: string) => `application:${applicationId}`;

const silentDays = (days: number) => `${countedUk(days, DAY_FORMS_UK)} без відповіді`;

function longestOf(payload: SilenceNotificationPayload): SilenceItem {
  const longest = longestSilentItemOf(payload);
  if (longest === undefined) throw new Error('a silence reminder holds no application');
  return longest;
}

function textOf(
  notification: PushedNotification,
  settings: Pick<UserSettings, 'timezone'>,
): PushText {
  switch (notification.type) {
    case 'silence': {
      const { company, days, applicationId } = longestOf(notification.payload);
      return {
        title: `${company}: ${silentDays(days)}`,
        body: 'Час нагадати про себе: відкрий картку і напиши фоллоу-ап.',
        tag: applicationTag(applicationId),
      };
    }
    case 'interview_soon': {
      const { startsAt, company, applicationId } = notification.payload;
      const clock = format(userNow(settings, new Date(startsAt)), 'HH:mm');
      return { title: `Співбесіда о ${clock}`, body: company, tag: applicationTag(applicationId) };
    }
    case 'auto_ghosted': {
      const { items, autoGhostDays } = notification.payload;
      const companies = items.map(({ company }) => company).join(', ');
      const body = `${companies} · понад ${silentDays(autoGhostDays)}`;
      return { title: 'Перенесено в ghosted', body, tag: 'auto-ghosted' };
    }
    case 'monthly_summary_ready': {
      const { month } = notification.payload;
      return {
        title: `Саммарі за ${monthNameOf(month)} готове`,
        body: 'Що вийшло за місяць і які кроки зробити далі.',
        tag: `summary:${month}`,
      };
    }
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled pushed notification: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function pushMessageOf(
  notification: PushedNotification,
  settings: Pick<UserSettings, 'timezone'>,
): PushMessage {
  return {
    ...textOf(notification, settings),
    url: notificationTargetOf(notification) ?? FALLBACK_URL,
  };
}
