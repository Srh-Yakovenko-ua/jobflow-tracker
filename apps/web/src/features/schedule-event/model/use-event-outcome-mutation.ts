import type { ScheduledEvent, Stage } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { scheduledEventKeys, updateScheduledEvent } from '@/entities/scheduled-event';

import { invalidateAfterSchedule } from './invalidate-after-schedule';
import { isScheduleConflict, showScheduleError } from './schedule-error';

export type EventOutcome = { status: 'done'; durationMin: number } | { status: 'cancelled' };

export type UseEventOutcomeMutationOptions = Readonly<{
  event: ScheduledEvent;
  onCompleted: (suggestedStage: Stage | null) => void;
}>;

export function useEventOutcomeMutation({ event, onCompleted }: UseEventOutcomeMutationOptions) {
  const queryClient = useQueryClient();
  const { applicationId } = event;
  const mutation = useMutation({
    mutationFn: (body: EventOutcome) =>
      updateScheduledEvent({ applicationId, eventId: event.id, body }),
    onSuccess: (response, body) => {
      if (body.status === 'done') onCompleted(response.suggestedStage);
      return invalidateAfterSchedule({ queryClient, applicationId });
    },
    onError: (error) => {
      showScheduleError(error);
      if (isScheduleConflict(error)) {
        void queryClient.invalidateQueries({ queryKey: scheduledEventKeys.list(applicationId) });
      }
    },
  });
  return {
    answering: mutation.isPending ? mutation.variables.status : null,
    answer: (outcome: EventOutcome) => {
      mutation.mutate(outcome);
    },
  };
}
