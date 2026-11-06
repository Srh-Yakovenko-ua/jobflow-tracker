import type { ScheduledEvent } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { scheduledEventKeys, updateScheduledEvent } from '@/entities/scheduled-event';

import { invalidateAfterSchedule } from './invalidate-after-schedule';
import { isScheduleConflict, showScheduleError } from './schedule-error';

export type EventReschedule = Readonly<{
  applicationId: ScheduledEvent['applicationId'];
  eventId: ScheduledEvent['id'];
  startsAt: ScheduledEvent['startsAt'];
}>;

export type RescheduleDrop = EventReschedule & Readonly<{ revert: () => void }>;

const RESCHEDULE_SCOPE = { id: 'reschedule-scheduled-event' } as const;

export function useRescheduleEventMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ applicationId, eventId, startsAt }: RescheduleDrop) =>
      updateScheduledEvent({ applicationId, eventId, body: { startsAt } }),
    scope: RESCHEDULE_SCOPE,
    onSuccess: (_saved, { applicationId }) =>
      invalidateAfterSchedule({ queryClient, applicationId }),
    onError: (error, drop) => {
      drop.revert();
      showScheduleError(error);
      if (isScheduleConflict(error)) {
        void queryClient.invalidateQueries({ queryKey: scheduledEventKeys.calendars() });
      }
    },
  });
  return {
    reschedule: (drop: RescheduleDrop) => {
      mutation.mutate(drop);
    },
  };
}
