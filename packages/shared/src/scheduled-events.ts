import { z } from 'zod';

import type { LocalizedLabel } from './labels.js';

export const SCHEDULED_EVENT_KINDS = [
  'screening_call',
  'tech_interview',
  'final_interview',
  'offer_call',
  'other',
] as const;

export const scheduledEventKindSchema = z.enum(SCHEDULED_EVENT_KINDS);

export type ScheduledEventKind = z.infer<typeof scheduledEventKindSchema>;

export const SCHEDULED_EVENT_KIND_LABELS: Record<ScheduledEventKind, LocalizedLabel> = {
  screening_call: { labelUk: 'Скринінг', labelEn: 'Screening' },
  tech_interview: { labelUk: "Техінтерв'ю", labelEn: 'Tech interview' },
  final_interview: { labelUk: 'Фінал', labelEn: 'Final' },
  offer_call: { labelUk: 'Офер', labelEn: 'Offer' },
  other: { labelUk: 'Зустріч', labelEn: 'Meeting' },
};

export const scheduledEventSlotSchema = z.object({
  kind: scheduledEventKindSchema,
  startsAt: z.iso.datetime(),
});

export const SCHEDULED_EVENT_STATUSES = ['planned', 'done', 'cancelled'] as const;

export const scheduledEventStatusSchema = z.enum(SCHEDULED_EVENT_STATUSES);

export type ScheduledEventStatus = z.infer<typeof scheduledEventStatusSchema>;
