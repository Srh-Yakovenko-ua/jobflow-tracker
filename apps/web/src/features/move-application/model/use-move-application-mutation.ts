import type { MoveApplicationInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { showErrorToast } from '@/shared/ui/error-toast';

import { moveApplication } from '../api/move-application';
import { moveErrorMessage } from '../lib/move-error-toast';
import { invalidateAfterMove } from './invalidate-after-move';
import { type ApplicationMove, withOptimisticBoard } from './optimistic-move';

function bodyOf({ application, toStage, reasonCode }: ApplicationMove): MoveApplicationInput {
  const body = { fromStage: application.currentStage, toStage };
  return reasonCode === undefined ? body : { ...body, reasonCode };
}

export function useMoveApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: ApplicationMove) =>
      withOptimisticBoard({
        queryClient,
        move,
        request: () => moveApplication({ applicationId: move.application.id, body: bodyOf(move) }),
      }),
    networkMode: 'always',
    onError: (error, move) => {
      const stages = { from: move.application.currentStage, to: move.toStage };
      showErrorToast(moveErrorMessage({ error, move: stages }));
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
}
