import {
  APPLICATION_FORMS_UK,
  countedUk,
  DAY_FORMS_UK,
  EMAIL_SETTING_OF,
  EMAILED_TYPES,
  type EmailedType,
  type InterviewPrepReadyNotificationPayload,
  interviewPrepTitleOf,
  type Notification,
  notificationTargetOf,
  type NotificationType,
  type SilenceItem,
  type Summary,
  type UserSettings,
} from '@jobflow/shared';

import { monthNameOf } from '../../common/year-month.js';

export type EmailItem = { title: string; detail: string | null; url: string | null };

export type EmailAction = { label: string; url: string };

export type EmailContent = {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  items: EmailItem[];
  action: EmailAction;
};

export type EmailedNotification = Extract<Notification, { type: EmailedType }>;

export type EmailContext = {
  summary: Summary | null;
  settings: Pick<UserSettings, 'timezone'>;
  webOrigin: string;
  now: Date;
};

type EmailCopy = Omit<EmailContent, 'action'> & { actionLabel: string };

type SilenceNotification = Extract<Notification, { type: 'silence' }>;

const EMAILED: ReadonlySet<NotificationType> = new Set(EMAILED_TYPES);

const FALLBACK_PATH = '/notifications';

const FOLLOW_UP_HINT = 'Час нагадати про себе: відкрий картку і напиши фоллоу-ап.';

export const isEmailedType = (type: NotificationType): type is EmailedType => EMAILED.has(type);

export const isEmailed = (notification: Notification): notification is EmailedNotification =>
  isEmailedType(notification.type);

export const isEmailOn = (settings: UserSettings, type: EmailedType): boolean =>
  settings.notifyEmail && settings[EMAIL_SETTING_OF[type]];

const linkOf = (webOrigin: string, path: string) => new URL(path, webOrigin).href;

export const unsubscribeUrlOf = (webOrigin: string, token: string) =>
  linkOf(webOrigin, `/unsubscribe?token=${encodeURIComponent(token)}`);

const silentDays = (days: number) => `${countedUk(days, DAY_FORMS_UK)} без відповіді`;

function silenceCopy(notification: SilenceNotification, { webOrigin }: EmailContext): EmailCopy {
  const { items } = notification.payload;
  const itemOf = (item: SilenceItem): EmailItem => {
    const single = { ...notification, payload: { items: [item] } };
    const path = notificationTargetOf(single) ?? FALLBACK_PATH;
    return { title: item.company, detail: silentDays(item.days), url: linkOf(webOrigin, path) };
  };
  const [only] = items;
  const subject =
    items.length === 1 && only !== undefined
      ? `${only.company}: ${silentDays(only.days)}`
      : `${countedUk(items.length, APPLICATION_FORMS_UK)} без відповіді`;
  return {
    subject,
    preheader: FOLLOW_UP_HINT,
    heading: 'Час нагадати про себе',
    paragraphs: [FOLLOW_UP_HINT],
    items: items.map(itemOf),
    actionLabel: 'Написати фоллоу-ап',
  };
}

function summaryCopy(month: Summary['month'], { summary }: EmailContext): EmailCopy {
  const title = `Саммарі за ${monthNameOf(month)} готове`;
  const preheader = 'Що вийшло за місяць і які кроки зробити далі.';
  return {
    subject: title,
    preheader,
    heading: title,
    paragraphs: [summary?.text ?? preheader],
    items: (summary?.actions ?? []).map(({ title, why }) => ({ title, detail: why, url: null })),
    actionLabel: 'Відкрити саммарі',
  };
}

function interviewPrepCopy(
  payload: InterviewPrepReadyNotificationPayload,
  { now, settings }: EmailContext,
): EmailCopy {
  const title = interviewPrepTitleOf({ payload, createdAt: now.toISOString() }, settings);
  const ready = 'Підготовка готова: теми, питання і що розповісти про себе.';
  return {
    subject: title,
    preheader: ready,
    heading: title,
    paragraphs: [ready],
    items: [],
    actionLabel: 'Відкрити підготовку',
  };
}

function copyOf(notification: EmailedNotification, context: EmailContext): EmailCopy {
  switch (notification.type) {
    case 'silence':
      return silenceCopy(notification, context);
    case 'monthly_summary_ready':
      return summaryCopy(notification.payload.month, context);
    case 'interview_prep_ready':
      return interviewPrepCopy(notification.payload, context);
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled emailed notification: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function emailContentOf(
  notification: EmailedNotification,
  context: EmailContext,
): EmailContent {
  const { actionLabel, ...copy } = copyOf(notification, context);
  const path = notificationTargetOf(notification) ?? FALLBACK_PATH;
  return { ...copy, action: { label: actionLabel, url: linkOf(context.webOrigin, path) } };
}
