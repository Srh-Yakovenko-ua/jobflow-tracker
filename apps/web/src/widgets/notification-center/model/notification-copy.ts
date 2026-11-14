import type {
  AutoGhostedNotificationPayload,
  Notification,
  SilenceNotificationPayload,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatClock } from '@/shared/lib/state-format';
import { monthNameOf } from '@/shared/lib/year-month';

export type NotificationCopy = Readonly<{ title: string; text: string; action: string }>;

const COPY = uk.notifications;

function silenceTextOf({ items }: SilenceNotificationPayload): string {
  const companies = items.map((item) => item.company).join(', ');
  const longest = Math.max(...items.map((item) => item.days));
  return COPY.silence.text(companies, longest);
}

function silenceCopy(payload: SilenceNotificationPayload): NotificationCopy {
  const title = COPY.silentCards(payload.items.length);
  return { title, text: silenceTextOf(payload), action: COPY.silence.action };
}

function autoGhostedCopy(payload: AutoGhostedNotificationPayload): NotificationCopy {
  const title = COPY.autoGhosted.title(payload.items.length, payload.autoGhostDays);
  return { title, text: silenceTextOf(payload), action: COPY.autoGhosted.action };
}

export function notificationCopyOf(notification: Notification, timeZone: string): NotificationCopy {
  switch (notification.type) {
    case 'silence':
      return silenceCopy(notification.payload);
    case 'auto_ghosted':
      return autoGhostedCopy(notification.payload);
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
