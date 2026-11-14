import { describe, expect, it } from 'vitest';

import { buildPlan } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { latestPlanResponseSchema, planItemParamsSchema, planItemPatchSchema } from './plan.js';

const PLAN = buildPlan();
const [FIRST_ITEM] = PLAN.items;

describe('latestPlanResponseSchema', () => {
  it.for([
    { label: 'the saved design plan of four actions', body: { plan: PLAN } },
    { label: 'no plan yet', body: { plan: null } },
  ])('accepts $label', ({ body }) => {
    expect(latestPlanResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'a plan month with a time',
      plan: { ...PLAN, month: '2026-09-01T00:00:00Z' },
      path: 'plan.month',
    },
    {
      label: 'an item done at a date without a time',
      plan: { ...PLAN, items: [{ ...FIRST_ITEM, doneAt: '2026-09-03' }] },
      path: 'plan.items.0.doneAt',
    },
    {
      label: 'an item with a negative position',
      plan: { ...PLAN, items: [{ ...FIRST_ITEM, position: -1 }] },
      path: 'plan.items.0.position',
    },
  ])('refuses $label at $path', ({ plan, path }) => {
    expect(issuePathsOf(latestPlanResponseSchema.safeParse({ plan }))).toEqual([path]);
  });
});

describe('planItemPatchSchema', () => {
  it.for([
    { label: 'checking an item', patch: { done: true } },
    { label: 'unchecking an item', patch: { done: false } },
    { label: 'a due date', patch: { dueAt: '2026-09-15T09:00:00.000Z' } },
    { label: 'clearing the due date', patch: { dueAt: null } },
    { label: 'both at once', patch: { done: true, dueAt: null } },
  ])('accepts $label', ({ patch }) => {
    expect(planItemPatchSchema.parse(patch)).toEqual(patch);
  });

  it.for([
    { label: 'an empty patch', patch: {}, path: '' },
    { label: 'done as a string', patch: { done: 'true' }, path: 'done' },
    { label: 'a due date without a time', patch: { dueAt: '2026-09-15' }, path: 'dueAt' },
  ])('refuses $label', ({ patch, path }) => {
    expect(issuePathsOf(planItemPatchSchema.safeParse(patch))).toEqual([path]);
  });
});

describe('planItemParamsSchema', () => {
  it('refuses an item id that is not a uuid', () => {
    const params = { planId: PLAN.id, itemId: '42' };
    expect(issuePathsOf(planItemParamsSchema.safeParse(params))).toEqual(['itemId']);
  });
});
