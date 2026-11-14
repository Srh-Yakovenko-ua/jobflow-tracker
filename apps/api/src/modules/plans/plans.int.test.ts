import { latestPlanResponseSchema, type Plan, planItemSchema, planSchema } from '@jobflow/shared';
import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import { callRoute, statusAndType } from '../../test/http.js';
import {
  planItemPath,
  planPath,
  PLANS_PATH,
  type SummaryOwner,
  summaryOwner,
} from '../../test/summaries.js';
import { NOW, settableClock } from '../../test/time.js';

const { actions } = buildMonthlySummaryOutput();

const DUE_AT = '2026-10-29T09:00:00.000Z';

type ItemPatch = { planId: string; itemId: string; body: object };

const clock = settableClock(NOW);

describe('the plans API', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  const save = async ({ accessToken, aiJobId }: SummaryOwner) => {
    const response = await callRoute(testApp.app, {
      method: 'post',
      path: planPath(aiJobId),
      accessToken,
    });
    expect(response.status).toBe(201);
    return planSchema.parse(response.body);
  };

  const patchItem = (accessToken: string, { planId, itemId, body }: ItemPatch) =>
    callRoute(testApp.app, {
      method: 'patch',
      path: planItemPath(planId, itemId),
      accessToken,
      body,
    });

  beforeEach(() => {
    clock.at(NOW);
  });

  const latest = (accessToken: string) =>
    callRoute(testApp.app, { method: 'get', path: `${PLANS_PATH}/latest`, accessToken });

  const firstItemOf = (plan: Plan) => ({ planId: plan.id, itemId: plan.items[0]?.id ?? '' });

  const savedItemPatcher = async () => {
    const olena = await summaryOwner(testApp.prisma);
    const item = firstItemOf(await save(olena));
    return async (body: object) => {
      const response = await patchItem(olena.accessToken, { ...item, body });
      expect(response.status).toBe(200);
      return planItemSchema.parse(response.body);
    };
  };

  it('saves the summary actions as the plan of the month in order, and a second save answers the same plan', async () => {
    const olena = await summaryOwner(testApp.prisma);

    const plan = await save(olena);
    const again = await save(olena);

    expect(plan).toMatchObject({ title: 'План на жовтень', month: '2026-10-01' });
    expect(plan.items.map(({ position, title }) => [position, title])).toEqual(
      actions.map(({ title }, position) => [position, title]),
    );
    expect(again).toEqual(plan);
    expect(await testApp.prisma.plan.count()).toBe(1);
  });

  it('checks an item at the server time, unchecks it, and sets and clears its due date', async () => {
    const patch = await savedItemPatcher();

    expect(await patch({ done: true })).toMatchObject({ doneAt: NOW.toISOString() });
    expect(await patch({ done: false })).toMatchObject({ doneAt: null });
    expect(await patch({ dueAt: DUE_AT })).toMatchObject({ dueAt: DUE_AT, doneAt: null });
    expect(await patch({ dueAt: null })).toMatchObject({ dueAt: null });
  });

  it('keeps the first check time when an item is checked again later, and unchecking still clears it', async () => {
    const patch = await savedItemPatcher();

    await patch({ done: true });
    clock.at(new Date('2026-10-23T09:00:00.000Z'));
    const again = await patch({ done: true });
    const unchecked = await patch({ done: false });

    expect([again.doneAt, unchecked.doneAt]).toEqual([NOW.toISOString(), null]);
  });

  it('shows the checked item in the latest plan, and no plan before the first one', async () => {
    const olena = await summaryOwner(testApp.prisma);
    expect((await latest(olena.accessToken)).body).toEqual({ plan: null });
    const item = firstItemOf(await save(olena));
    await patchItem(olena.accessToken, { ...item, body: { done: true } });

    const response = await latest(olena.accessToken);

    expect(response.status).toBe(200);
    const { plan } = latestPlanResponseSchema.parse(response.body);
    expect(plan?.items.map(({ doneAt }) => doneAt)).toEqual([NOW.toISOString(), null, null, null]);
  });

  it("answers 404 to another user's plan item and to an item of another plan, and changes nothing", async () => {
    const olena = await summaryOwner(testApp.prisma);
    const bohdan = await summaryOwner(testApp.prisma);
    const olenaItem = firstItemOf(await save(olena));
    const bohdanItem = firstItemOf(await save(bohdan));
    const done = { done: true };

    const foreign = await patchItem(bohdan.accessToken, { ...olenaItem, body: done });
    const crossed = { planId: bohdanItem.planId, itemId: olenaItem.itemId, body: done };
    const mixed = await patchItem(bohdan.accessToken, crossed);

    expect([statusAndType(foreign), statusAndType(mixed)]).toEqual([
      [404, 'not_found'],
      [404, 'not_found'],
    ]);
    expect(await testApp.prisma.planItem.count({ where: { doneAt: { not: null } } })).toBe(0);
  });

  it('answers 422 to an empty patch', async () => {
    const olena = await summaryOwner(testApp.prisma);
    const item = firstItemOf(await save(olena));

    const response = await patchItem(olena.accessToken, { ...item, body: {} });

    expect(statusAndType(response)).toEqual([422, 'validation_error']);
  });

  it.each([
    { method: 'get', path: `${PLANS_PATH}/latest` },
    {
      method: 'patch',
      path: planItemPath(
        '0199f0a0-0000-7000-8000-000000000301',
        '0199f0a0-0000-7000-8000-000000000302',
      ),
    },
  ] as const)('answers 401 to $method $path without a token', async ({ method, path }) => {
    expect((await callRoute(testApp.app, { method, path, body: { done: true } })).status).toBe(401);
  });
});
