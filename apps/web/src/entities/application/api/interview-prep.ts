import { type Application, interviewPrepResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { applicationKeys } from '../model/keys';

export function applicationInterviewPrepQueryOptions(id: Application['id']) {
  return queryOptions({
    queryKey: applicationKeys.interviewPrep(id),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: `/applications/${id}/interview-prep`,
        schema: interviewPrepResponseSchema,
        signal,
      }),
  });
}
