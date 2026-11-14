import type { ApplicationBoardQuery, ApplicationBoardResponse } from '@jobflow/shared';

export const SILENT_ONLY: ApplicationBoardQuery = { silence: ['silent'] };

export function silentCountOf(board: ApplicationBoardResponse): number {
  return Object.values(board.columns).reduce((sum, column) => sum + column.count, 0);
}
