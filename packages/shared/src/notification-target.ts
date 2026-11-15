import type {
  AiDoneNotificationPayload,
  Notification,
  NotifiedAiKind,
  SilenceItem,
  SilenceNotificationPayload,
} from './notifications.js';

const FOLLOW_UP_ANCHOR = '#follow-up';

const REVIEW_ANCHOR = '#review';

function followUpOf(applicationId: string): string {
  return `/applications/${applicationId}${FOLLOW_UP_ANCHOR}`;
}

export function longestSilentItemOf({
  items,
}: SilenceNotificationPayload): SilenceItem | undefined {
  const [first, ...rest] = items;
  if (first === undefined) return undefined;
  return rest.reduce((kept, item) => (item.days > kept.days ? item : kept), first);
}

function longestSilentOf(payload: SilenceNotificationPayload): string | null {
  const longest = longestSilentItemOf(payload);
  return longest === undefined ? null : followUpOf(longest.applicationId);
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
    case 'interview_prep_ready':
      return `/applications/${notification.payload.applicationId}`;
    case 'ai_done':
    case 'ai_failed':
      return AI_TARGETS[notification.payload.kind](notification.payload);
    case 'auto_ghosted':
      return '/board';
    case 'insight_unlocked':
      return '/analytics';
    case 'monthly_summary_ready':
      return `/analytics/summary/${notification.payload.month}`;
    case 'export_ready':
      return `/settings?export=${notification.payload.exportId}#account`;
    default: {
      const unhandled: never = notification;
      throw new Error(`Unhandled notification: ${JSON.stringify(unhandled)}`);
    }
  }
}
