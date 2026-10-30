import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApplicationMove } from '@/entities/application';
import { showErrorToast } from '@/shared/ui/error-toast';

import { undoLastMove } from '../api/undo-move';
import { undoErrorMessage } from '../lib/undo-error-toast';
import { invalidateAfterMove } from './invalidate-after-move';
import { withOptimisticBoard } from './optimistic-move';

function reverseOf({ application, toStage }: ApplicationMove): ApplicationMove {
  return {
    application: { ...application, currentStage: toStage },
    toStage: application.currentStage,
  };
}

export function useUndoMoveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: ApplicationMove) =>
      withOptimisticBoard({
        queryClient,
        move: reverseOf(move),
        request: () => undoLastMove(move.application.id),
      }),
    networkMode: 'always',
    onError: (error) => {
      showErrorToast(undoErrorMessage(error));
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
}
