import { type QueryClient, useIsMutating } from '@tanstack/react-query';

import { MOVE_MUTATION_KEY } from './optimistic-move';

const MOVING = { mutationKey: MOVE_MUTATION_KEY };

export function isMovePending(queryClient: QueryClient): boolean {
  return queryClient.isMutating(MOVING) > 0;
}

export function useRerenderOnMoveChange(): void {
  useIsMutating(MOVING);
}
