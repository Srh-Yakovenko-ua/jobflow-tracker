import { useMutation, useQueryClient } from '@tanstack/react-query';

import { userKeys } from '@/entities/user';

import { unsubscribeEmail } from '../api/unsubscribe-email';

export function useUnsubscribeEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unsubscribeEmail,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
    onError: () => undefined,
  });
}
