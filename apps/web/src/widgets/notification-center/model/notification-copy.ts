import type { Notification, YearMonth } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatClock } from '@/shared/lib/state-format';

export type NotificationCopy = Readonly<{ title: string; text: string; action: string }>;

const COPY = uk.notifications;

const MONTH_DIGITS_FROM = 'YYYY-'.length;

function silenceCopy({ items }: Extract<Notification, { type: 'silence' }>['payload']) {
  const companies = items.map((item) => item.company).join(', ');
  const longest = Math.max(...items.map((item) => item.days));
  return {
    title: COPY.silentCards(items.length),
    text: COPY.silence.text(companies, longest),
    action: COPY.silence.action,
  };
}

function monthNameOf(month: YearMonth): string {
  return uk.calendar.months[Number(month.slice(MONTH_DIGITS_FROM)) - 1] ?? month;
}

export function notificationCopyOf(notification: Notification, timeZone: string): NotificationCopy {
  switch (notification.type) {
    case 'silence':
      return silenceCopy(notification.payload);
    case 'interview_soon': {
      const { startsAt, company } = notification.payload;
      const clock = formatClock({ at: new Date(startsAt), timeZone });
      return {
        title: COPY.interviewSoon.title(clock),
        text: company,
        action: COPY.interviewSoon.action,
      };
    }
    case 'ai_done':
      return COPY.aiDone[notification.payload.kind];
    case 'ai_failed':
      return COPY.aiFailed[notification.payload.kind];
    case 'insight_unlocked': {
      const { insightUnlocked } = COPY;
      const text = insightUnlocked.text(notification.payload.applications);
      return { title: insightUnlocked.title, text, action: insightUnlocked.action };
    }
    case 'monthly_summary_ready': {
      const { title, text, action } = COPY.monthlySummaryReady;
      return { title: title(monthNameOf(notification.payload.month)), text, action };
    }
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled notification: ${JSON.stringify(unhandled)}`);
    }
  }
}
