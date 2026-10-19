import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'silence',
  'interview_soon',
  'ai_done',
  'ai_failed',
  'monthly_summary_ready',
  'insight_unlocked',
  'plan_item_due',
] as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = z.infer<typeof notificationTypeSchema>;
