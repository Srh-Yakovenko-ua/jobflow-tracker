import { z } from 'zod';

export const REMINDER_TYPES = ['followup', 'interview_soon'] as const;

export const reminderTypeSchema = z.enum(REMINDER_TYPES);

export type ReminderType = z.infer<typeof reminderTypeSchema>;

export const REMINDER_STATUSES = ['pending', 'done', 'snoozed', 'dismissed'] as const;

export const reminderStatusSchema = z.enum(REMINDER_STATUSES);

export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
