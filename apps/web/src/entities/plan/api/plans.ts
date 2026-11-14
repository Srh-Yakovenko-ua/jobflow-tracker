import {
  latestPlanResponseSchema,
  type PlanItem,
  type PlanItemParams,
  type PlanItemPatch,
  planItemSchema,
} from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

import { planKeys } from '../model/keys';

export type PatchPlanItem = PlanItemParams & Readonly<{ patch: PlanItemPatch }>;

export function latestPlanQueryOptions() {
  return queryOptions({
    queryKey: planKeys.latest(),
    queryFn: ({ signal }) =>
      apiClient.request({ path: '/plans/latest', schema: latestPlanResponseSchema, signal }),
  });
}

export function patchPlanItem({ planId, itemId, patch }: PatchPlanItem): Promise<PlanItem> {
  return apiClient.request({
    path: `/plans/${planId}/items/${itemId}`,
    method: 'PATCH',
    body: patch,
    schema: planItemSchema,
  });
}
