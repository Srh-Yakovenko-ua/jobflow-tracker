import type {
  LatestPlanResponse,
  MonthlySummaryAction,
  Plan,
  PlanItem,
  PlanItemParams,
  PlanItemPatch,
  PlanProgress,
  YearMonth,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { owned } from '../../common/owned.js';
import { firstDayOf, monthNameOf } from '../../common/year-month.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { type PlanItemRow, type PlanRow, PlansRepository } from './plans.repository.js';

export type PlanFromSummary = {
  aiResultId: string;
  month: YearMonth;
  actions: MonthlySummaryAction[];
};

export type PlanItemUpdate = PlanItemParams & { patch: PlanItemPatch };

const PLAN_ITEM_NOT_FOUND = 'Plan item not found';

const isoOrNull = (date: Date | null) => date?.toISOString() ?? null;

const toPlanItem = ({ dueAt, doneAt, ...item }: PlanItemRow): PlanItem => ({
  ...item,
  dueAt: isoOrNull(dueAt),
  doneAt: isoOrNull(doneAt),
});

const toPlan = ({ month, createdAt, items, ...plan }: PlanRow): Plan => ({
  ...plan,
  month: month.toISOString().slice(0, 10),
  createdAt: createdAt.toISOString(),
  items: items.map(toPlanItem),
});

function itemChangeOf({ done, dueAt }: PlanItemPatch, now: Date) {
  return {
    ...(done !== undefined && { doneAt: done ? now : null }),
    ...(dueAt !== undefined && { dueAt: dueAt === null ? null : new Date(dueAt) }),
  };
}

@Injectable()
export class PlansService {
  constructor(
    private readonly repository: PlansRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  createFromSummary(
    userId: string,
    { aiResultId, month, actions }: PlanFromSummary,
  ): Promise<Plan> {
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockUser(userId, { tx });
      const existing = await this.repository.findBySummary(userId, { aiResultId, tx });
      if (existing !== null) {
        return toPlan(existing);
      }
      const plan = {
        aiResultId,
        title: `План на ${monthNameOf(month)}`,
        month: firstDayOf(month),
        items: actions.map((action, position) => ({ ...action, position })),
      };
      return toPlan(await this.repository.create(userId, { plan, tx }));
    });
  }

  async latest(userId: string): Promise<LatestPlanResponse> {
    const plan = await this.repository.findLatest(userId);
    return { plan: plan === null ? null : toPlan(plan) };
  }

  async progress(userId: string, month: YearMonth): Promise<PlanProgress | null> {
    const items = await this.repository.findItemsOfMonth(userId, firstDayOf(month));
    if (items.length === 0) {
      return null;
    }
    return { items: items.length, done: items.filter(({ doneAt }) => doneAt !== null).length };
  }

  async patchItem(userId: string, { planId, itemId, patch }: PlanItemUpdate): Promise<PlanItem> {
    const data = itemChangeOf(patch, this.clock.now());
    const item = await this.repository.updateItem(userId, { planId, itemId, data });
    return toPlanItem(owned(item, PLAN_ITEM_NOT_FOUND));
  }
}
