import {
  type CreateScheduledEventInput,
  createScheduledEventInputSchema,
  type ScheduledEvent,
  type ScheduledEventKind,
  scheduledEventKindSchema,
  type Stage,
  userSettingsSchema,
} from '@jobflow/shared';
import { isAfter } from 'date-fns';
import { z } from 'zod';

import { uk } from '@/shared/i18n';
import { addDays } from '@/shared/lib/calendar-month';
import { dayKeyOf, instantOf, wallClockOf } from '@/shared/lib/zoned-time';

import { DEFAULT_KIND } from '../lib/default-kind';

export type ScheduleFormValues = {
  kind: ScheduledEventKind;
  day: string;
  time: string;
  durationMin: number;
  locationOrLink: string;
};

export type ScheduleField = keyof ScheduleFormValues;

export type ScheduleClock = Readonly<{ timeZone: string; clock: () => Date }>;

export type ScheduleDefaultsInput = Readonly<{
  stage: Stage;
  event?: ScheduledEvent | undefined;
  now: Date;
  timeZone: string;
}>;

const ERRORS = uk.applicationPage.schedule.errors;

const NEW_SLOT = { time: '10:00', durationMin: 60, locationOrLink: '' } as const;

const SHARED_FIELDS = createScheduledEventInputSchema.shape;

const slotSchema = z.object({
  day: z.iso.date(),
  time: z.string().min(1, { error: ERRORS.time }).pipe(userSettingsSchema.shape.quietHoursStart),
});

const valuesSchema = slotSchema.extend({
  kind: scheduledEventKindSchema,
  durationMin: SHARED_FIELDS.durationMin.unwrap(),
  locationOrLink: z
    .string()
    .trim()
    .transform((text) => (text === '' ? null : text))
    .pipe(SHARED_FIELDS.locationOrLink.unwrap()),
});

export type ScheduleFormOutput = z.output<typeof valuesSchema>;

export type ScheduleInputOf = Readonly<{ values: ScheduleFormOutput; timeZone: string }>;

export function scheduleDefaultsOf({
  stage,
  event,
  now,
  timeZone,
}: ScheduleDefaultsInput): ScheduleFormValues {
  if (event === undefined) {
    return { kind: DEFAULT_KIND[stage], day: addDays(dayKeyOf(now, timeZone), 1), ...NEW_SLOT };
  }
  return {
    kind: event.kind,
    ...wallClockOf(event.startsAt, timeZone),
    durationMin: event.durationMin,
    locationOrLink: event.locationOrLink ?? '',
  };
}

export function scheduleFormSchemaOf({ timeZone, clock }: ScheduleClock) {
  return valuesSchema.refine((values) => isAfter(instantOf({ ...values, timeZone }), clock()), {
    error: ERRORS.startsInPast,
    path: ['time'],
    when: (payload) => slotSchema.safeParse(payload.value).success,
  });
}

export function toScheduledEventInput({
  values,
  timeZone,
}: ScheduleInputOf): CreateScheduledEventInput {
  const { day, time, ...slot } = values;
  return { ...slot, startsAt: instantOf({ day, time, timeZone }) };
}
