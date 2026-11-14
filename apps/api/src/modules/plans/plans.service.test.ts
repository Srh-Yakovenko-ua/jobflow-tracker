import { buildMonthlySummaryOutput } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import type { CreatePlan, PlanItemChange, PlanOfSummary, PlanRow } from './plans.repository.js';
import { PlansRepository } from './plans.repository.js';
import { PlansService } from './plans.service.js';

const AI_RESULT_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f01';

const { actions } = buildMonthlySummaryOutput();

type StoredPlan = PlanRow & { userId: string };

const idOf = (prefix: string, index: number) =>
  `0199f1a2-7c3b-7d4e-8f50-6a7b8c9d${prefix}${String(index).padStart(2, '0')}`;

class FakePlansRepository {
  readonly plans: StoredPlan[] = [];

  readonly steps: unknown[][] = [];

  lockUser(userId: string, { tx }: { tx: unknown }): Promise<void> {
    this.steps.push(['lockUser', userId, tx]);
    return Promise.resolve();
  }

  findBySummary(userId: string, { aiResultId }: PlanOfSummary) {
    const found = this.plans.find(
      (plan) => plan.userId === userId && plan.aiResultId === aiResultId,
    );
    return Promise.resolve(found ?? null);
  }

  create(userId: string, { plan, tx }: CreatePlan): Promise<PlanRow> {
    this.steps.push(['create', userId, tx]);
    const index = this.plans.length;
    const items = plan.items.map((item, position) => ({
      ...item,
      id: idOf('1', index * 10 + position),
      dueAt: null,
      doneAt: null,
    }));
    const stored = { ...plan, userId, id: idOf('0', index), createdAt: NOW, items };
    this.plans.push(stored);
    return Promise.resolve(stored);
  }

  findLatest(userId: string) {
    return Promise.resolve(this.plans.filter((plan) => plan.userId === userId).at(-1) ?? null);
  }

  findItemsOfMonth(userId: string, month: Date) {
    const plan = this.plans.find(
      (candidate) => candidate.userId === userId && candidate.month.getTime() === month.getTime(),
    );
    return Promise.resolve(plan?.items ?? []);
  }

  updateItem(userId: string, { planId, itemId, data }: PlanItemChange) {
    const plan = this.plans.find(
      (candidate) => candidate.userId === userId && candidate.id === planId,
    );
    const item = plan?.items.find((candidate) => candidate.id === itemId);
    if (item === undefined) {
      return Promise.resolve(null);
    }
    Object.assign(item, data);
    return Promise.resolve({ ...item });
  }
}

async function plansWithFake() {
  const repository = new FakePlansRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [PlansService, PlansRepository],
    now: NOW,
  })
    .overrideProvider(PlansRepository)
    .useValue(repository)
    .compile();
  const service = moduleRef.get(PlansService);
  const save = (userId = OLENA_ID) =>
    service.createFromSummary(userId, { aiResultId: AI_RESULT_ID, month: '2026-09', actions });
  return { repository, service, save };
}

describe('PlansService.createFromSummary', () => {
  it('creates the plan of the month in one transaction under the user lock with the actions in order', async () => {
    const { repository, save } = await plansWithFake();

    const plan = await save();

    expect(plan).toMatchObject({
      title: 'План на вересень',
      month: '2026-09-01',
      aiResultId: AI_RESULT_ID,
    });
    expect(plan.items.map(({ position, title }) => [position, title])).toEqual(
      actions.map(({ title }, position) => [position, title]),
    );
    expect(plan.items[0]).toMatchObject({ ...actions[0], dueAt: null, doneAt: null });
    expect(repository.steps).toEqual([
      ['lockUser', OLENA_ID, FAKE_TRANSACTION],
      ['create', OLENA_ID, FAKE_TRANSACTION],
    ]);
  });

  it('answers the plan already saved from the same summary and creates no second one', async () => {
    const { repository, save } = await plansWithFake();

    const first = await save();
    const second = await save();

    expect(second).toEqual(first);
    expect(repository.plans).toHaveLength(1);
  });
});

describe('PlansService.progress', () => {
  it('counts the items of the plan of a month and the ones done, and answers null without a plan', async () => {
    const { repository, service, save } = await plansWithFake();
    await save();
    repository.plans[0]?.items.slice(0, 3).forEach((item) => {
      item.doneAt = NOW;
    });

    await expect(service.progress(OLENA_ID, '2026-09')).resolves.toEqual({ items: 4, done: 3 });
    await expect(service.progress(OLENA_ID, '2026-10')).resolves.toBeNull();
    await expect(service.progress(BOHDAN_ID, '2026-09')).resolves.toBeNull();
  });
});

describe('PlansService.patchItem', () => {
  it('checks an item at the clock time, clears the check, and sets and clears the due date', async () => {
    const { service, save } = await plansWithFake();
    const { id: planId, items } = await save();
    const itemId = items[1]?.id ?? '';
    const patch = (body: object) => service.patchItem(OLENA_ID, { planId, itemId, patch: body });

    await expect(patch({ done: true })).resolves.toMatchObject({ doneAt: NOW.toISOString() });
    await expect(patch({ done: false })).resolves.toMatchObject({ doneAt: null });
    await expect(patch({ dueAt: '2026-09-14T09:00:00.000Z' })).resolves.toMatchObject({
      dueAt: '2026-09-14T09:00:00.000Z',
      doneAt: null,
    });
    await expect(patch({ dueAt: null })).resolves.toMatchObject({ dueAt: null });
  });

  it("answers 404 to an item of another user's plan and changes nothing", async () => {
    const { repository, service, save } = await plansWithFake();
    const { id: planId, items } = await save();

    await expect(
      service.patchItem(BOHDAN_ID, { planId, itemId: items[0]?.id ?? '', patch: { done: true } }),
    ).rejects.toMatchObject({ body: { status: 404, detail: 'Plan item not found' } });
    expect(repository.plans[0]?.items[0]?.doneAt).toBeNull();
  });
});
