'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Application, ApplicationResponse, ScheduledEvent } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';

import { scheduledEventsQueryOptions } from '@/entities/scheduled-event';
import { useUserTimeZone } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { useLastPresent } from '@/shared/lib/use-last-present';
import { dayKeyOf } from '@/shared/lib/zoned-time';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import type { CalendarDays } from '@/shared/ui/calendar';
import {
  Dialog,
  DialogClose,
  DialogContent,
  type DialogContentHandlers,
  DialogFooter,
} from '@/shared/ui/dialog';

import { eventDaysOf } from '../lib/event-days';
import {
  scheduleDefaultsOf,
  type ScheduleFormOutput,
  scheduleFormSchemaOf,
  type ScheduleFormValues,
} from '../model/schedule-form';
import { useScheduleEventMutation } from '../model/use-schedule-event-mutation';
import { ScheduleFormFields, type ScheduleFormMethods } from './schedule-form-fields';

export type SchedulePlan = { kind: 'schedule' } | { kind: 'reschedule'; event: ScheduledEvent };

export type ScheduleDialogActions = Readonly<{ onClose: () => void }>;

export type ScheduleEventDialogProps = Readonly<{
  application: ApplicationResponse;
  plan: SchedulePlan | null;
  actions: ScheduleDialogActions;
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

type ScheduleFormProps = Readonly<{
  application: ApplicationResponse;
  plan: SchedulePlan;
  actions: ScheduleDialogActions;
}>;

type CalendarDaysInput = Readonly<{
  applicationId: Application['id'];
  today: string;
  timeZone: string;
}>;

const COPY = uk.applicationPage.schedule;

function eventOf(plan: SchedulePlan): ScheduledEvent | undefined {
  return plan.kind === 'reschedule' ? plan.event : undefined;
}

function useCalendarDays({ applicationId, today, timeZone }: CalendarDaysInput): CalendarDays {
  const { data: marked = {} } = useQuery({
    ...scheduledEventsQueryOptions(applicationId),
    select: (list) => eventDaysOf({ events: list.items, timeZone }),
  });
  return { today, min: today, ...(Object.keys(marked).length > 0 && { marked }) };
}

function FormError({ methods }: Readonly<{ methods: ScheduleFormMethods }>) {
  const { errors } = useFormState({ control: methods.control });
  if (errors.root?.server === undefined) return null;
  return <Banner tone="error" content={uk.applicationPage.editor.invalid} />;
}

function ScheduleForm({ application, plan, actions }: ScheduleFormProps) {
  const timeZone = useUserTimeZone();
  const [openedAt] = useState(Date.now);
  const now = new Date(openedAt);
  const event = eventOf(plan);
  const methods = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    mode: 'onBlur',
    defaultValues: scheduleDefaultsOf({ stage: application.currentStage, event, now, timeZone }),
    resolver: zodResolver(scheduleFormSchemaOf({ timeZone, clock: () => new Date() })),
  });
  const mutation = useScheduleEventMutation({
    target: { applicationId: application.id, event },
    timeZone,
    setError: methods.setError,
  });
  const today = dayKeyOf(now, timeZone);
  const days = useCalendarDays({ applicationId: application.id, today, timeZone });
  const submit = methods.handleSubmit((values) => {
    mutation.save({ values, onSaved: actions.onClose });
  });
  return (
    <form
      noValidate
      onSubmit={(formEvent) => {
        void submit(formEvent);
      }}
      className="flex flex-col gap-4.5"
    >
      <FormError methods={methods} />
      <ScheduleFormFields form={{ methods, days }} />
      <DialogFooter className="justify-end">
        <DialogClose asChild>
          <Button variant="outline">{COPY.cancel}</Button>
        </DialogClose>
        <Button type="submit" loading={mutation.isPending}>
          {COPY.save[plan.kind]}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ScheduleEventDialog({
  application,
  plan,
  actions,
  handlers,
}: ScheduleEventDialogProps) {
  const timeZone = useUserTimeZone();
  const shown = useLastPresent(plan);
  return (
    <Dialog
      open={plan !== null}
      onOpenChange={(open) => {
        if (!open) actions.onClose();
      }}
    >
      {shown && (
        <DialogContent header={{ title: COPY.titles[shown.kind] }} handlers={{ ...handlers }}>
          <ScheduleForm key={timeZone} application={application} plan={shown} actions={actions} />
        </DialogContent>
      )}
    </Dialog>
  );
}
