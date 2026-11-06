'use client';

import {
  SCHEDULED_EVENT_KIND_LABELS,
  SCHEDULED_EVENT_KINDS,
  SCHEDULED_EVENT_LIMITS,
} from '@jobflow/shared';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn, useFormState } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import type { CalendarDays } from '@/shared/ui/calendar';
import { DateField } from '@/shared/ui/date-field';
import { Field } from '@/shared/ui/field';
import type { SelectOptionGroup } from '@/shared/ui/field-surface';
import { Input } from '@/shared/ui/input';
import { NumberInput } from '@/shared/ui/number-input';
import { Select } from '@/shared/ui/select';

import type { ScheduleField, ScheduleFormOutput, ScheduleFormValues } from '../model/schedule-form';

export type ScheduleFormMethods = UseFormReturn<ScheduleFormValues, unknown, ScheduleFormOutput>;

export type ScheduleFormFieldsProps = Readonly<{
  form: { methods: ScheduleFormMethods; days: CalendarDays };
}>;

type FieldShellProps = Readonly<{
  methods: ScheduleFormMethods;
  name: ScheduleField;
  children: ReactNode;
}>;

const COPY = uk.applicationPage.schedule;

const LABELS: Readonly<Record<ScheduleField, string>> = {
  kind: COPY.fields.kind,
  day: COPY.fields.date,
  time: COPY.fields.time,
  durationMin: COPY.fields.duration,
  locationOrLink: COPY.fields.location,
};

const KIND_GROUPS: readonly SelectOptionGroup[] = [
  {
    options: SCHEDULED_EVENT_KINDS.map((kind) => ({
      value: kind,
      label: SCHEDULED_EVENT_KIND_LABELS[kind].labelUk,
    })),
  },
];

export const DURATION_RANGE = {
  min: SCHEDULED_EVENT_LIMITS.durationMinMin,
  max: SCHEDULED_EVENT_LIMITS.durationMinMax,
  step: 15,
} as const;

function FieldShell({ methods, name, children }: FieldShellProps) {
  const { errors } = useFormState({ control: methods.control, name });
  return (
    <Field label={LABELS[name]} footer={{ error: errors[name]?.message }}>
      {children}
    </Field>
  );
}

export function ScheduleFormFields({ form: { methods, days } }: ScheduleFormFieldsProps) {
  const { control, register } = methods;
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <FieldShell methods={methods} name="kind">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Select groups={KIND_GROUPS} value={field.value} onValueChange={field.onChange} />
          )}
        />
      </FieldShell>
      <FieldShell methods={methods} name="durationMin">
        <Controller
          control={control}
          name="durationMin"
          render={({ field }) => (
            <NumberInput
              value={field.value}
              onValueChange={field.onChange}
              range={DURATION_RANGE}
              unit={COPY.minutes}
            />
          )}
        />
      </FieldShell>
      <FieldShell methods={methods} name="day">
        <Controller
          control={control}
          name="day"
          rules={{ deps: ['time'] }}
          render={({ field }) => (
            <DateField selection={{ value: field.value, onSelect: field.onChange }} days={days} />
          )}
        />
      </FieldShell>
      <FieldShell methods={methods} name="time">
        <Input type="time" {...register('time')} />
      </FieldShell>
      <div className="sm:col-span-2">
        <FieldShell methods={methods} name="locationOrLink">
          <Input
            maxLength={SCHEDULED_EVENT_LIMITS.locationOrLinkMaxLength}
            {...register('locationOrLink')}
          />
        </FieldShell>
      </div>
    </div>
  );
}
