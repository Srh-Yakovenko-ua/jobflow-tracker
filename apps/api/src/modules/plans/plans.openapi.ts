import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  latestPlanResponseSchema,
  type Plan,
  planItemParamsSchema,
  type PlanItemPatch,
  planItemPatchSchema,
  planItemSchema,
  planSchema,
} from '@jobflow/shared';

import { errorResponses, jsonContent } from '../../openapi/route.js';

const EXAMPLE_PLAN_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f00';

const EXAMPLE_ITEM_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f10';

const ITEM = {
  id: EXAMPLE_ITEM_ID,
  position: 0,
  title: "Два тижні алгоритмів перед техінтерв'ю",
  why: "3 з 4 відмов на техінтерв'ю: «не вистачає скілів», а пройшов ти 4 з 9.",
  expectedEffect: "Якщо конверсія техінтерв'ю дійде до 60%, прогноз офера: від 4 до 12 тижнів.",
  metric: "Конверсія техінтерв'ю: зараз 50%, ціль 60%",
  dueAt: '2026-09-14T09:00:00.000Z',
  doneAt: '2026-09-12T18:30:00.000Z',
} satisfies Plan['items'][number];

export const EXAMPLE_PLAN = {
  id: EXAMPLE_PLAN_ID,
  title: 'План на вересень',
  month: '2026-09-01',
  aiResultId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f01',
  createdAt: '2026-09-01T05:10:00.000Z',
  items: [ITEM],
} satisfies Plan;

const PATCH = { done: true, dueAt: '2026-09-14T09:00:00.000Z' } satisfies PlanItemPatch;

const planItemParams = planItemParamsSchema.extend({
  planId: planItemParamsSchema.shape.planId.meta({ example: EXAMPLE_PLAN_ID }),
  itemId: planItemParamsSchema.shape.itemId.meta({ example: EXAMPLE_ITEM_ID }),
});

export const PLANS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/plans/latest',
    tags: ['plans'],
    summary: 'Read the latest action plan',
    description:
      'The plan of the latest month the signed-in user saved from a monthly summary, with its items in action order, or plan null before the first one. Read only.',
    responses: {
      200: {
        description: 'The latest plan or null',
        content: jsonContent(latestPlanResponseSchema, { plan: EXAMPLE_PLAN }),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'patch',
    path: '/plans/{planId}/items/{itemId}',
    tags: ['plans'],
    summary: 'Check, uncheck or date a plan item',
    description:
      'done true stores the server time as doneAt, done false clears it; dueAt sets or (null) clears the due date. At least one of the two. An item of another user’s plan, or an item outside the plan, answers 404.',
    request: {
      params: planItemParams,
      body: { required: true, content: jsonContent(planItemPatchSchema, PATCH) },
    },
    responses: {
      200: { description: 'The changed item', content: jsonContent(planItemSchema, ITEM) },
      ...errorResponses([400, 401, 403, 404, 422]),
    },
  },
];

export const PLAN_RESPONSE = { schema: planSchema, example: EXAMPLE_PLAN };
