import {
  type LatestPlanResponse,
  type Plan,
  type PlanItem,
  type PlanItemParams,
  planItemPatchSchema,
} from '@jobflow/shared';
import { buildPlan } from '@jobflow/shared/testing';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, errorReply } from './api-handlers';

type ItemParams = PlanItemParams;

export type PlanRouteOptions = Readonly<{
  plan?: Plan | null;
  now?: Date;
  latestReply?: HttpResponseResolver;
  patchReply?: HttpResponseResolver<ItemParams>;
}>;

export type SentPlanPatch = PlanItemParams & { body: unknown };

const DONE_BEFORE = 3;

export const DESIGN_PLAN = buildPlan({
  items: buildPlan().items.map((item, position) => ({
    ...item,
    doneAt: position < DONE_BEFORE ? '2026-11-05T09:00:00.000Z' : null,
    dueAt: position === 0 ? '2026-11-20T10:00:00.000Z' : null,
  })),
});

function patchedReply(store: { plan: Plan | null; now: Date }): HttpResponseResolver<ItemParams> {
  return async ({ request, params }) => {
    const patch = planItemPatchSchema.parse(await request.json());
    const items = store.plan?.id === params.planId ? store.plan.items : [];
    const item = items.find((candidate) => candidate.id === params.itemId);
    if (store.plan === null || item === undefined) {
      return errorReply({ status: 404, type: 'not_found' });
    }
    const patched: PlanItem = {
      ...item,
      ...(patch.done === undefined ? {} : { doneAt: patch.done ? store.now.toISOString() : null }),
      ...(patch.dueAt === undefined ? {} : { dueAt: patch.dueAt }),
    };
    store.plan = {
      ...store.plan,
      items: items.map((candidate) => (candidate.id === item.id ? patched : candidate)),
    };
    return HttpResponse.json(patched);
  };
}

export function planRoutes({
  plan = DESIGN_PLAN,
  now = new Date('2026-11-14T10:00:00.000Z'),
  latestReply,
  patchReply,
}: PlanRouteOptions = {}) {
  const store = { plan, now };
  const sent = { latestReads: 0, patches: [] as SentPlanPatch[] };
  const replyToPatch = patchReply ?? patchedReply(store);
  const handlers = [
    http.get(apiUrl('/plans/latest'), (info) => {
      sent.latestReads += 1;
      const latest: LatestPlanResponse = { plan: store.plan };
      return latestReply === undefined ? HttpResponse.json(latest) : latestReply(info);
    }),
    http.patch<ItemParams>(apiUrl('/plans/:planId/items/:itemId'), async (info) => {
      const { planId, itemId } = info.params;
      sent.patches.push({ planId, itemId, body: await info.request.clone().json() });
      return replyToPatch(info);
    }),
  ];
  return { handlers, sent };
}
