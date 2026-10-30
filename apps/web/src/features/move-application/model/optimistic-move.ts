import type { ApplicationBoardResponse, ApplicationResponse } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

import { applicationKeys, type ApplicationMove } from '@/entities/application';

import { boardAfterMove } from '../lib/board-after-move';

export type OptimisticMove = Readonly<{
  queryClient: QueryClient;
  move: ApplicationMove;
  request: () => Promise<ApplicationResponse>;
}>;

type BoardPatch = Omit<OptimisticMove, 'request'>;

const BOARDS = { queryKey: applicationKeys.boards() };

async function patchBoards({ queryClient, move }: BoardPatch) {
  await queryClient.cancelQueries(BOARDS);
  const snapshot = queryClient.getQueriesData<ApplicationBoardResponse>(BOARDS);
  const patch = { ...move, at: new Date().toISOString() };
  queryClient.setQueriesData<ApplicationBoardResponse>(
    BOARDS,
    (board) => board && boardAfterMove(board, patch),
  );
  return snapshot;
}

export async function withOptimisticBoard({
  queryClient,
  move,
  request,
}: OptimisticMove): Promise<ApplicationResponse> {
  const snapshot = await patchBoards({ queryClient, move });
  try {
    return await request();
  } catch (error) {
    snapshot.forEach(([queryKey, board]) => {
      queryClient.setQueryData(queryKey, board);
    });
    throw error;
  }
}
