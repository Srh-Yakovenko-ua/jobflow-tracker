import { type MoveApplicationInput, STAGE_LABELS, STAGE_MOVE_LIMITS } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApplicationMove } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { moveApplication } from '../api/move-application';
import { moveErrorMessage } from '../lib/move-error-toast';
import { invalidateAfterMove } from './invalidate-after-move';
import { MOVE_MUTATION_KEY, withOptimisticBoard } from './optimistic-move';
import { useUndoMoveMutation } from './use-undo-move-mutation';

type MoveMutationEvents = Readonly<{ onRollback?: (move: ApplicationMove) => void }>;

const MOVED_TOAST_ID = 'stage-move-done';

const COPY = uk.board.move.done;

function bodyOf({ application, toStage, reasonCode }: ApplicationMove): MoveApplicationInput {
  const body = { fromStage: application.currentStage, toStage };
  return reasonCode === undefined ? body : { ...body, reasonCode };
}

export function useMoveApplicationMutation({ onRollback }: MoveMutationEvents = {}) {
  const queryClient = useQueryClient();
  const undo = useUndoMoveMutation();
  return useMutation({
    mutationKey: MOVE_MUTATION_KEY,
    mutationFn: (move: ApplicationMove) =>
      withOptimisticBoard({
        queryClient,
        move,
        request: () => moveApplication({ applicationId: move.application.id, body: bodyOf(move) }),
      }),
    networkMode: 'always',
    onSuccess: (_moved, move) => {
      if (move.reasonCode !== undefined) return;
      showToast(
        {
          tone: 'undo',
          title: COPY.title(STAGE_LABELS[move.toStage].labelUk),
          action: {
            label: COPY.undo,
            onAction: () => {
              undo.mutate(move);
            },
          },
        },
        { id: MOVED_TOAST_ID, duration: STAGE_MOVE_LIMITS.undoWindowMs },
      );
    },
    onError: (error, move) => {
      const stages = { from: move.application.currentStage, to: move.toStage };
      showErrorToast(moveErrorMessage({ error, move: stages }));
      onRollback?.(move);
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
}
