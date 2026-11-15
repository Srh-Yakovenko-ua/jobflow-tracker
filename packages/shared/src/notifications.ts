import { z } from 'zod';

import type { AiKind } from './ai/kinds.js';
import { exportFormatSchema } from './schemas/account.js';
import { paginatedSchema, paginationQuerySchema } from './schemas/pagination.js';
import { yearMonthSchema } from './schemas/year-month.js';

export const NOTIFICATION_TYPES = [
  'silence',
  'interview_soon',
  'ai_done',
  'ai_failed',
  'monthly_summary_ready',
  'insight_unlocked',
  'plan_item_due',
  'auto_ghosted',
  'export_ready',
] as const;

export const NOTIFIED_AI_KINDS = [
  'vacancy_parse',
  'resume_parse',
  'followup',
] as const satisfies readonly AiKind[];

export const NOTIFICATION_LIMITS = { readIdsMax: 100 } as const;

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const silenceItemSchema = z.object({
  applicationId: z.uuid(),
  company: z.string().min(1),
  days: z.int().positive(),
});

export const silenceNotificationPayloadSchema = z.object({
  items: z.array(silenceItemSchema).min(1),
});

export const autoGhostedNotificationPayloadSchema = silenceNotificationPayloadSchema.extend({
  autoGhostDays: z.int().positive(),
});

export const interviewSoonNotificationPayloadSchema = z.object({
  applicationId: z.uuid(),
  scheduledEventId: z.uuid(),
  company: z.string().min(1),
  startsAt: z.iso.datetime(),
  minutesBefore: z.int().positive(),
});

export const aiDoneNotificationPayloadSchema = z.object({
  aiJobId: z.uuid(),
  kind: z.enum(NOTIFIED_AI_KINDS),
  applicationId: z.uuid().optional(),
  resumeVersionId: z.uuid().optional(),
});

export const aiFailedNotificationPayloadSchema = aiDoneNotificationPayloadSchema.extend({
  errorType: z.string().min(1),
});

export const insightUnlockedNotificationPayloadSchema = z.object({
  applications: z.int().positive(),
});

export const monthlySummaryReadyNotificationPayloadSchema = z.object({
  aiJobId: z.uuid(),
  month: yearMonthSchema,
});

export const exportReadyNotificationPayloadSchema = z.object({
  exportId: z.uuid(),
  format: exportFormatSchema,
});

const notificationBaseSchema = z.object({
  id: z.uuid(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

function notificationOf<Type extends NotificationType, Payload extends z.ZodType>(
  type: Type,
  payload: Payload,
) {
  return notificationBaseSchema.extend({ type: z.literal(type), payload });
}

export const notificationSchema = z.discriminatedUnion('type', [
  notificationOf('silence', silenceNotificationPayloadSchema),
  notificationOf('interview_soon', interviewSoonNotificationPayloadSchema),
  notificationOf('ai_done', aiDoneNotificationPayloadSchema),
  notificationOf('ai_failed', aiFailedNotificationPayloadSchema),
  notificationOf('insight_unlocked', insightUnlockedNotificationPayloadSchema),
  notificationOf('monthly_summary_ready', monthlySummaryReadyNotificationPayloadSchema),
  notificationOf('auto_ghosted', autoGhostedNotificationPayloadSchema),
  notificationOf('export_ready', exportReadyNotificationPayloadSchema),
]);

export const notificationListQuerySchema = paginationQuerySchema.extend({
  cursor: z.uuid().optional(),
  unread: z.stringbool().optional(),
});

export const notificationListResponseSchema = paginatedSchema(notificationSchema);

export const markNotificationsReadInputSchema = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(NOTIFICATION_LIMITS.readIdsMax) }),
  z.object({ all: z.literal(true) }),
]);

export const markNotificationsReadResponseSchema = z.object({
  unread: z.int().nonnegative(),
});

export type NotifiedAiKind = (typeof NOTIFIED_AI_KINDS)[number];
export type SilenceItem = z.infer<typeof silenceItemSchema>;
export type SilenceNotificationPayload = z.infer<typeof silenceNotificationPayloadSchema>;
export type AutoGhostedNotificationPayload = z.infer<typeof autoGhostedNotificationPayloadSchema>;
export type InterviewSoonNotificationPayload = z.infer<
  typeof interviewSoonNotificationPayloadSchema
>;
export type AiDoneNotificationPayload = z.infer<typeof aiDoneNotificationPayloadSchema>;
export type AiFailedNotificationPayload = z.infer<typeof aiFailedNotificationPayloadSchema>;
export type InsightUnlockedNotificationPayload = z.infer<
  typeof insightUnlockedNotificationPayloadSchema
>;
export type MonthlySummaryReadyNotificationPayload = z.infer<
  typeof monthlySummaryReadyNotificationPayloadSchema
>;
export type ExportReadyNotificationPayload = z.infer<typeof exportReadyNotificationPayloadSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInputSchema>;
export type MarkNotificationsReadResponse = z.infer<typeof markNotificationsReadResponseSchema>;
