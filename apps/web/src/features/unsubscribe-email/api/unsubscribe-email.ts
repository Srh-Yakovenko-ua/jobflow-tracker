import {
  type EmailUnsubscribeInput,
  type EmailUnsubscribeResponse,
  emailUnsubscribeResponseSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function unsubscribeEmail(input: EmailUnsubscribeInput): Promise<EmailUnsubscribeResponse> {
  return apiClient.request({
    path: '/email/unsubscribe',
    method: 'POST',
    body: input,
    schema: emailUnsubscribeResponseSchema,
  });
}
