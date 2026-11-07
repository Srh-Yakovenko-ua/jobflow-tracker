import {
  type Application,
  type CreateScheduledEventInput,
  SCHEDULED_EVENT_LIMITS,
  type ScheduledEvent,
} from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { createScheduledEvent, updateScheduledEvent } from '@/entities/scheduled-event';
import { type GuardedSave, useGuardedSave, useSubmitKey } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { invalidateAfterSchedule } from './invalidate-after-schedule';
import {
  type ScheduleFormOutput,
  type ScheduleFormValues,
  toScheduledEventInput,
} from './schedule-form';

export type ScheduleTarget = Readonly<{
  applicationId: Application['id'];
  event: ScheduledEvent | undefined;
}>;

export type UseScheduleEventMutationOptions = Readonly<{
  target: ScheduleTarget;
  timeZone: string;
  setError: UseFormSetError<ScheduleFormValues>;
  onSaved: () => void;
}>;

type SaveEventRequest = Readonly<{
  target: ScheduleTarget;
  body: CreateScheduledEventInput;
  idempotencyKey: string;
}>;

const SAVE_KEY = ['scheduled-event', 'save'] as const;

const ERRORS = uk.applicationPage.schedule.errors;

const SERVER_FIELDS = ['kind', 'durationMin', 'locationOrLink'] as const;

const SERVER_MESSAGES = {
  kind: ERRORS.kind,
  durationMin: ERRORS.durationMin(
    SCHEDULED_EVENT_LIMITS.durationMinMin,
    SCHEDULED_EVENT_LIMITS.durationMinMax,
  ),
  locationOrLink: ERRORS.locationOrLink(SCHEDULED_EVENT_LIMITS.locationOrLinkMaxLength),
} as const;

function saveEvent({ target: { applicationId, event }, body, idempotencyKey }: SaveEventRequest) {
  return event === undefined
    ? createScheduledEvent({ applicationId, body, idempotencyKey })
    : updateScheduledEvent({ applicationId, eventId: event.id, body });
}

export function useScheduleEventMutation({
  target,
  timeZone,
  setError,
  onSaved,
}: UseScheduleEventMutationOptions): GuardedSave<ScheduleFormOutput> {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useGuardedSave({
    mutationKey: SAVE_KEY,
    request: (values: ScheduleFormOutput) => {
      const body = toScheduledEventInput({ values, timeZone });
      return saveEvent({ target, body, idempotencyKey: submitKey.keyFor(body) });
    },
    form: { fields: SERVER_FIELDS, setError, messages: SERVER_MESSAGES },
    onSuccess: () => {
      submitKey.reset();
      void invalidateAfterSchedule({ queryClient, applicationId: target.applicationId });
      onSaved();
    },
  });
}
