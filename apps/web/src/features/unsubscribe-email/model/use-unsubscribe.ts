import { type EmailUnsubscribeInput, emailUnsubscribeResponseSchema } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { userKeys } from '@/entities/user';
import { apiClient } from '@/shared/api';

export function useUnsubscribeEmailMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EmailUnsubscribeInput) =>
      apiClient.request({
        path: '/email/unsubscribe',
        method: 'POST',
        body: input,
        schema: emailUnsubscribeResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.me() }),
    onError: () => undefined,
  });
}
