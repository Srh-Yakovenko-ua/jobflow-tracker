import { z } from 'zod';

export const SCHEDULED_EVENT_KINDS = [
  'screening_call',
  'tech_interview',
  'final_interview',
  'offer_call',
  'other',
] as const;

export const scheduledEventKindSchema = z.enum(SCHEDULED_EVENT_KINDS);

export type ScheduledEventKind = z.infer<typeof scheduledEventKindSchema>;

export const SCHEDULED_EVENT_STATUSES = ['planned', 'done', 'cancelled'] as const;

export const scheduledEventStatusSchema = z.enum(SCHEDULED_EVENT_STATUSES);

export type ScheduledEventStatus = z.infer<typeof scheduledEventStatusSchema>;
