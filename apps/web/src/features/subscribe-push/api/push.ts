import {
  pushPublicKeySchema,
  type PushSubscriptionCreated,
  pushSubscriptionCreatedSchema,
  type PushSubscriptionInput,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';
import { hasPushSubscription } from '@/shared/lib/push-subscription';

import { pushKeys } from '../model/keys';

export function pushPublicKeyQueryOptions() {
  return queryOptions({
    queryKey: pushKeys.publicKey(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/push/public-key', schema: pushPublicKeySchema, signal }),
    staleTime: Infinity,
  });
}

export function browserSubscribedQueryOptions() {
  return queryOptions({
    queryKey: pushKeys.browserSubscribed(),
    queryFn: hasPushSubscription,
  });
}

export function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<PushSubscriptionCreated> {
  return apiClient.request({
    path: '/push/subscriptions',
    method: 'POST',
    schema: pushSubscriptionCreatedSchema,
    body: input,
  });
}
