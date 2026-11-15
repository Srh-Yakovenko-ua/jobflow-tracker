import { type Application, cvHintsResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationCvHintsQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.cvHints(id),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${id}/cv-hints`,
        schema: cvHintsResponseSchema,
        signal,
      }),
  });
}
