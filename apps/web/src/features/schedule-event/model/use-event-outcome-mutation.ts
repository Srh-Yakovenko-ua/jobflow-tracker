import type { ScheduledEvent, Stage } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { scheduledEventKeys, updateScheduledEvent } from '@/entities/scheduled-event';
import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { invalidateAfterSchedule } from './invalidate-after-schedule';

export type EventOutcome = { status: 'done'; durationMin: number } | { status: 'cancelled' };

export type UseEventOutcomeMutationOptions = Readonly<{
  event: ScheduledEvent;
  onCompleted: (suggestedStage: Stage | null) => void;
}>;

function isConflict(error: Error): boolean {
  return error instanceof ApiError && error.status === 409;
}

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
      if (!isConflict(error)) {
        showErrorToast(uk.errors.saveFailed);
        return;
      }
      showErrorToast(uk.applicationPage.schedule.conflict);
      void queryClient.invalidateQueries({ queryKey: scheduledEventKeys.list(applicationId) });
    },
  });
  return {
    answering: mutation.isPending ? mutation.variables.status : null,
    answer: (outcome: EventOutcome) => {
      mutation.mutate(outcome);
    },
  };
}
