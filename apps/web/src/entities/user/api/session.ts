import { queryOptions } from '@tanstack/react-query';

import { ensureAccessToken } from '@/shared/api';

import { userKeys } from '../model/keys';

const ACTIVE_SESSION = 'active';

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: userKeys.session(),
    queryFn: () => ensureAccessToken().then(() => ACTIVE_SESSION),
    staleTime: Infinity,
  });
}
