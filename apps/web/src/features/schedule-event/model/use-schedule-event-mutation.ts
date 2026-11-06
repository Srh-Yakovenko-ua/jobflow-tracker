import {
  type Application,
  type CreateScheduledEventInput,
  SCHEDULED_EVENT_LIMITS,
  type ScheduledEvent,
} from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { createScheduledEvent, updateScheduledEvent } from '@/entities/scheduled-event';
import { ApiError, applyFieldErrors } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

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
}>;

type SaveEventRequest = Readonly<{ target: ScheduleTarget; body: CreateScheduledEventInput }>;

type ScheduleSave = Readonly<{ values: ScheduleFormOutput; onSaved: () => void }>;

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

function saveEvent({ target: { applicationId, event }, body }: SaveEventRequest) {
  return event === undefined
    ? createScheduledEvent({ applicationId, body })
    : updateScheduledEvent({ applicationId, eventId: event.id, body });
}

export function useScheduleEventMutation({
  target,
  timeZone,
  setError,
}: UseScheduleEventMutationOptions) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: SAVE_KEY,
    mutationFn: (values: ScheduleFormOutput) =>
      saveEvent({ target, body: toScheduledEventInput({ values, timeZone }) }),
    onSuccess: () => {
      void invalidateAfterSchedule({ queryClient, applicationId: target.applicationId });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        applyFieldErrors({ error, fields: SERVER_FIELDS, setError, messages: SERVER_MESSAGES });
        return;
      }
      showErrorToast(uk.errors.saveFailed);
    },
  });
  return {
    isPending: mutation.isPending,
    save: ({ values, onSaved }: ScheduleSave) => {
      if (queryClient.isMutating({ mutationKey: SAVE_KEY }) > 0) return;
      mutation.mutate(values, { onSuccess: onSaved });
    },
  };
}
