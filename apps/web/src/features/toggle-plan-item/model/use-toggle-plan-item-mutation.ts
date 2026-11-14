'use client';

import type { LatestPlanResponse, PlanItem } from '@jobflow/shared';

import {
  latestPlanQueryOptions,
  type PatchPlanItem,
  patchPlanItem,
  planKeys,
} from '@/entities/plan';
import { useOptimisticMutation } from '@/shared/api';
import { uk } from '@/shared/i18n';

const { queryKey: LATEST_KEY } = latestPlanQueryOptions();

function patchedIn(item: PlanItem, { itemId, patch }: PatchPlanItem): PlanItem {
  if (item.id !== itemId) return item;
  const done =
    patch.done === undefined ? {} : { doneAt: patch.done ? new Date().toISOString() : null };
  const due = patch.dueAt === undefined ? {} : { dueAt: patch.dueAt };
  return { ...item, ...done, ...due };
}

function toggledIn(latest: LatestPlanResponse, toggle: PatchPlanItem): LatestPlanResponse {
  if (!latest.plan) return latest;
  return {
    plan: { ...latest.plan, items: latest.plan.items.map((item) => patchedIn(item, toggle)) },
  };
}

export function useTogglePlanItemMutation() {
  return useOptimisticMutation({
    queryKey: LATEST_KEY,
    invalidateKey: planKeys.all,
    update: toggledIn,
    request: patchPlanItem,
    failure: uk.reminders.plan.toggleFailed,
  });
}
