import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';

import { type ErrorToastContent, showErrorToast } from '@/shared/ui/error-toast';

export type OptimisticMutationOptions<Cached, Variables, Result> = Readonly<{
  queryKey: QueryKey;
  invalidateKey: QueryKey;
  update: (cached: Cached, variables: Variables) => Cached;
  request: (variables: Variables) => Promise<Result>;
  failure: ErrorToastContent;
}>;

export function useOptimisticMutation<Cached, Variables, Result>({
  queryKey,
  invalidateKey,
  update,
  request,
  failure,
}: OptimisticMutationOptions<Cached, Variables, Result>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: Variables) => {
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<Cached>(queryKey);
      queryClient.setQueryData<Cached>(queryKey, (cached) => cached && update(cached, variables));
      try {
        return await request(variables);
      } catch (error) {
        queryClient.setQueryData(queryKey, snapshot);
        throw error;
      }
    },
    onError: () => {
      showErrorToast(failure);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });
}
