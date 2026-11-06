import { type Application, contactListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { contactKeys } from '../model/keys';

export function contactsQueryOptions(applicationId: Application['id']) {
  return queryOptions({
    queryKey: contactKeys.list(applicationId),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${applicationId}/contacts`,
        schema: contactListResponseSchema,
        signal,
      }),
  });
}
