import { type EmailUnsubscribeInput, emailUnsubscribeResponseSchema } from '@jobflow/shared';
import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

export function useUnsubscribeEmailMutation() {
  return useMutation({
    mutationFn: (input: EmailUnsubscribeInput) =>
      apiClient.request({
        path: '/email/unsubscribe',
        method: 'POST',
        body: input,
        schema: emailUnsubscribeResponseSchema,
      }),
    onError: () => undefined,
  });
}
