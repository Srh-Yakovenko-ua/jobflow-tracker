import { type Application, noteListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { noteKeys } from '../model/keys';

export function notesQueryOptions(applicationId: Application['id']) {
  return queryOptions({
    queryKey: noteKeys.list(applicationId),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${applicationId}/notes`,
        schema: noteListResponseSchema,
        signal,
      }),
  });
}
