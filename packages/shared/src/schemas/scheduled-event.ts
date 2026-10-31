import { z } from 'zod';

import { reminderStatusSchema } from '../reminders.js';
import { scheduledEventKindSchema, scheduledEventStatusSchema } from '../scheduled-events.js';
import { wholeDaysBetween } from '../silence.js';
import { stageSchema } from '../stages.js';
import { isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE } from './patch.js';
import { plainTextSchema } from './text.js';

export const SCHEDULED_EVENT_LIMITS = {
  durationMinMin: 5,
  durationMinMax: 480,
  locationOrLinkMaxLength: 500,
  outcomeNoteMaxLength: 2000,
} as const;

export const CALENDAR_LIMITS = { rangeMaxDays: 62 } as const;

export const scheduledEventIdSchema = z.uuid();

export const scheduledEventSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  kind: scheduledEventKindSchema,
  startsAt: z.iso.datetime(),
  durationMin: z.int().positive(),
  locationOrLink: z.string().nullable(),
  status: scheduledEventStatusSchema,
  outcomeNote: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const offsetDateTimeSchema = z.iso.datetime({ offset: true });

const scheduledEventFieldsSchema = z.object({
  kind: scheduledEventKindSchema,
  startsAt: offsetDateTimeSchema,
  durationMin: z
    .int()
    .min(SCHEDULED_EVENT_LIMITS.durationMinMin)
    .max(SCHEDULED_EVENT_LIMITS.durationMinMax),
  locationOrLink: plainTextSchema(SCHEDULED_EVENT_LIMITS.locationOrLinkMaxLength).nullable(),
  status: scheduledEventStatusSchema,
  outcomeNote: plainTextSchema(SCHEDULED_EVENT_LIMITS.outcomeNoteMaxLength).nullable(),
});

export const createScheduledEventInputSchema = scheduledEventFieldsSchema
  .pick({ kind: true, startsAt: true, durationMin: true, locationOrLink: true })
  .partial({ durationMin: true, locationOrLink: true });

export const updateScheduledEventInputSchema = scheduledEventFieldsSchema
  .partial()
  .refine(isNonEmptyPatch, NON_EMPTY_PATCH_ISSUE);

export const scheduledEventListResponseSchema = z.object({ items: z.array(scheduledEventSchema) });

export const scheduledEventUpdateResponseSchema = scheduledEventSchema.extend({
  suggestedStage: stageSchema.nullable(),
});

const calendarRangeSchema = z.object({ from: offsetDateTimeSchema, to: offsetDateTimeSchema });

type CalendarRange = z.infer<typeof calendarRangeSchema>;

const rangeIsOrdered = ({ from, to }: CalendarRange) => Date.parse(to) > Date.parse(from);

const rangeFitsCap = ({ from, to }: CalendarRange) =>
  wholeDaysBetween(new Date(from), new Date(to)) <= CALENDAR_LIMITS.rangeMaxDays;

export const calendarQuerySchema = calendarRangeSchema
  .refine(rangeIsOrdered, { error: 'to must be later than from', path: ['to'] })
  .refine(rangeFitsCap, {
    error: `A calendar range spans at most ${String(CALENDAR_LIMITS.rangeMaxDays)} days`,
    path: ['to'],
  });

const calendarApplicationSchema = z.object({
  applicationId: z.uuid(),
  company: z.string().min(1),
  stage: stageSchema,
});

export const calendarItemSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  start: z.union([z.iso.datetime(), z.iso.date()]),
  end: z.iso.datetime().nullable(),
  allDay: z.boolean(),
  extendedProps: z.discriminatedUnion('type', [
    calendarApplicationSchema.extend({
      type: z.literal('scheduled_event'),
      eventKind: scheduledEventKindSchema,
      status: scheduledEventStatusSchema,
      locationOrLink: z.string().nullable(),
    }),
    calendarApplicationSchema.extend({
      type: z.literal('followup'),
      reminderStatus: reminderStatusSchema,
    }),
  ]),
});

export const calendarResponseSchema = z.object({ items: z.array(calendarItemSchema) });

export type ScheduledEvent = z.infer<typeof scheduledEventSchema>;
export type CreateScheduledEventInput = z.infer<typeof createScheduledEventInputSchema>;
export type UpdateScheduledEventInput = z.infer<typeof updateScheduledEventInputSchema>;
export type ScheduledEventListResponse = z.infer<typeof scheduledEventListResponseSchema>;
export type ScheduledEventUpdateResponse = z.infer<typeof scheduledEventUpdateResponseSchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type CalendarItem = z.infer<typeof calendarItemSchema>;
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
