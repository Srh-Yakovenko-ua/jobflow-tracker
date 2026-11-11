import type { ApplicationResponse } from '@jobflow/shared';
import type { QueryClient } from '@tanstack/react-query';

export const DELETE_MUTATION_KEY = ['application-delete'] as const;

export function isDeleteSent(
  queryClient: QueryClient,
  applicationId: ApplicationResponse['id'],
): boolean {
  const sent = queryClient.getMutationCache().find({
    mutationKey: DELETE_MUTATION_KEY,
    predicate: ({ state }) => state.variables === applicationId && state.status !== 'error',
  });
  return sent !== undefined;
}
