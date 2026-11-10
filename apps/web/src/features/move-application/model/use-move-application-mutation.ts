import type { MoveApplicationInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApplicationMove } from '@/entities/application';
import { showErrorToast } from '@/shared/ui/error-toast';

import { moveApplication } from '../api/move-application';
import { moveErrorMessage } from '../lib/move-error-toast';
import { invalidateAfterMove } from './invalidate-after-move';
import { MOVE_MUTATION_KEY, withOptimisticBoard } from './optimistic-move';

type MoveMutationEvents = Readonly<{ onRollback?: (move: ApplicationMove) => void }>;

function bodyOf({ application, toStage, reasonCode }: ApplicationMove): MoveApplicationInput {
  const body = { fromStage: application.currentStage, toStage };
  return reasonCode === undefined ? body : { ...body, reasonCode };
}

export function useMoveApplicationMutation({ onRollback }: MoveMutationEvents = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: MOVE_MUTATION_KEY,
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
      onRollback?.(move);
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
}
