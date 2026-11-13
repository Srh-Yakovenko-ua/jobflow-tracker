import { z } from 'zod';

import { reminderStatusSchema, reminderTypeSchema } from '../reminders.js';
import { calendarApplicationSchema } from './scheduled-event.js';

export const REMINDER_LIMITS = { snoozeDays: { min: 1, max: 30 } } as const;

export const reminderIdSchema = z.uuid();

export const reminderSchema = calendarApplicationSchema.extend({
  id: z.uuid(),
  type: reminderTypeSchema,
  status: reminderStatusSchema,
  scheduledEventId: z.uuid().nullable(),
  dueAt: z.iso.datetime(),
  snoozedUntil: z.iso.datetime().nullable(),
});

export const reminderListResponseSchema = z.object({ items: z.array(reminderSchema) });

export const snoozeReminderInputSchema = z.object({
  days: z.int().min(REMINDER_LIMITS.snoozeDays.min).max(REMINDER_LIMITS.snoozeDays.max),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type ReminderListResponse = z.infer<typeof reminderListResponseSchema>;
export type SnoozeReminderInput = z.infer<typeof snoozeReminderInputSchema>;
