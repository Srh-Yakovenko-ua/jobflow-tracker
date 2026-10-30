import type {
  ApplicationBoardResponse,
  ApplicationCard,
  ApplicationResponse,
  MoveApplicationInput,
  RejectionReasonCode,
  Stage,
} from '@jobflow/shared';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { showErrorToast } from '@/shared/ui/error-toast';

import { moveApplication } from '../api/move-application';
import { boardAfterMove } from '../lib/board-after-move';
import { moveErrorMessage } from '../lib/move-error-toast';
import { invalidateAfterMove } from './invalidate-after-move';

export type ApplicationMove = Readonly<{
  application: ApplicationCard;
  toStage: Stage;
  reasonCode?: RejectionReasonCode;
}>;

type OptimisticMove = Readonly<{ queryClient: QueryClient; move: ApplicationMove }>;

const BOARDS = { queryKey: applicationKeys.boards() };

function bodyOf({ application, toStage, reasonCode }: ApplicationMove): MoveApplicationInput {
  const body = { fromStage: application.currentStage, toStage };
  return reasonCode === undefined ? body : { ...body, reasonCode };
}

async function patchBoards({ queryClient, move }: OptimisticMove) {
  await queryClient.cancelQueries(BOARDS);
  const snapshot = queryClient.getQueriesData<ApplicationBoardResponse>(BOARDS);
  const patch = { ...move, at: new Date().toISOString() };
  queryClient.setQueriesData<ApplicationBoardResponse>(
    BOARDS,
    (board) => board && boardAfterMove(board, patch),
  );
  return snapshot;
}

async function moveWithRollback({
  queryClient,
  move,
}: OptimisticMove): Promise<ApplicationResponse> {
  const snapshot = await patchBoards({ queryClient, move });
  try {
    return await moveApplication({ applicationId: move.application.id, body: bodyOf(move) });
  } catch (error) {
    snapshot.forEach(([queryKey, board]) => {
      queryClient.setQueryData(queryKey, board);
    });
    throw error;
  }
}

export function useMoveApplicationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (move: ApplicationMove) => moveWithRollback({ queryClient, move }),
    networkMode: 'always',
    onError: (error, move) => {
      const stages = { from: move.application.currentStage, to: move.toStage };
      showErrorToast(moveErrorMessage({ error, move: stages }));
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
}
