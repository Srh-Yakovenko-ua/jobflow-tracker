import { settingsSuggestionsSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { userKeys } from '../model/keys';

export function settingsSuggestionsQueryOptions() {
  return queryOptions({
    queryKey: userKeys.settingsSuggestions(),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: '/settings/suggestions',
        schema: settingsSuggestionsSchema,
        signal,
      }),
  });
}
