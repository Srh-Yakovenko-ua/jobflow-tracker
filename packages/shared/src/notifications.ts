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

export const silenceNotificationPayloadSchema = z.object({
  applicationId: z.uuid(),
  company: z.string().min(1),
  days: z.int().positive(),
});

export const interviewSoonNotificationPayloadSchema = z.object({
  applicationId: z.uuid(),
  scheduledEventId: z.uuid(),
  company: z.string().min(1),
  startsAt: z.iso.datetime(),
  minutesBefore: z.int().positive(),
});

export type SilenceNotificationPayload = z.infer<typeof silenceNotificationPayloadSchema>;
export type InterviewSoonNotificationPayload = z.infer<
  typeof interviewSoonNotificationPayloadSchema
>;
