import type {
  AiDoneNotificationPayload,
  Notification,
  NotifiedAiKind,
  SilenceNotificationPayload,
} from '@jobflow/shared';

const FOLLOW_UP_ANCHOR = '#follow-up';

const REVIEW_ANCHOR = '#review';

function followUpOf(applicationId: string): string {
  return `/applications/${applicationId}${FOLLOW_UP_ANCHOR}`;
}

function longestSilentOf({ items }: SilenceNotificationPayload): string | null {
  const [first, ...rest] = items;
  if (first === undefined) return null;
  const longest = rest.reduce((kept, item) => (item.days > kept.days ? item : kept), first);
  return followUpOf(longest.applicationId);
}

const AI_TARGETS: Record<NotifiedAiKind, (payload: AiDoneNotificationPayload) => string | null> = {
  vacancy_parse: ({ applicationId, aiJobId }) =>
    applicationId === undefined
      ? null
      : `/add?review=${applicationId}&job=${aiJobId}${REVIEW_ANCHOR}`,
  resume_parse: () => '/resumes',
  followup: ({ applicationId }) => (applicationId === undefined ? null : followUpOf(applicationId)),
};

export function notificationTargetOf(notification: Notification): string | null {
  switch (notification.type) {
    case 'silence':
      return longestSilentOf(notification.payload);
    case 'interview_soon':
      return `/applications/${notification.payload.applicationId}`;
    case 'ai_done':
    case 'ai_failed':
      return AI_TARGETS[notification.payload.kind](notification.payload);
    case 'insight_unlocked':
      return '/analytics';
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled notification: ${JSON.stringify(unhandled)}`);
    }
  }
}
