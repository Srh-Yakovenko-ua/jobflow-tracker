import type { ApplicationBoardResponse } from '@jobflow/shared';

export function silentCountOf(board: ApplicationBoardResponse): number {
  return Object.values(board.columns).reduce((sum, column) => sum + column.count, 0);
}
