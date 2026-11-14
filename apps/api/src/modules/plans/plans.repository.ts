import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import type { InTransaction } from '../../prisma/in-transaction.js';
import { lockUser } from '../../prisma/lock-user.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const PLAN_ITEM_SELECT = {
  id: true,
  position: true,
  title: true,
  why: true,
  expectedEffect: true,
  metric: true,
  dueAt: true,
  doneAt: true,
} satisfies Prisma.PlanItemSelect;

const PLAN_SELECT = {
  id: true,
  title: true,
  month: true,
  aiResultId: true,
  createdAt: true,
  items: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: PLAN_ITEM_SELECT },
} satisfies Prisma.PlanSelect;

export type PlanRow = Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>;

export type PlanItemRow = Prisma.PlanItemGetPayload<{ select: typeof PLAN_ITEM_SELECT }>;

export type NewPlanItem = Omit<PlanItemRow, 'id' | 'dueAt' | 'doneAt'>;

export type NewPlan = Pick<PlanRow, 'aiResultId' | 'title' | 'month'> & { items: NewPlanItem[] };

export type PlanOfSummary = Required<InTransaction> & { aiResultId: string };

export type CreatePlan = Required<InTransaction> & { plan: NewPlan };

export type PlanItemKey = Required<InTransaction> & { planId: string; itemId: string };

export type PlanItemChange = PlanItemKey & {
  data: Partial<Pick<PlanItemRow, 'dueAt' | 'doneAt'>>;
};

const ownedItemWhere = (userId: string, { planId, itemId }: PlanItemKey) =>
  ({ id: itemId, planId, plan: { userId } }) satisfies Prisma.PlanItemWhereInput;

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockUser(userId: string, { tx }: Required<InTransaction>): Promise<void> {
    await lockUser(tx, userId);
  }

  findBySummary(userId: string, { aiResultId, tx }: PlanOfSummary): Promise<PlanRow | null> {
    return tx.plan.findFirst({
      where: { userId, aiResultId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: PLAN_SELECT,
    });
  }

  create(userId: string, { plan, tx }: CreatePlan): Promise<PlanRow> {
    const { items, ...fields } = plan;
    return tx.plan.create({
      data: { ...fields, userId, items: { create: items } },
      select: PLAN_SELECT,
    });
  }

  findLatest(userId: string): Promise<PlanRow | null> {
    return this.prisma.plan.findFirst({
      where: { userId },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: PLAN_SELECT,
    });
  }

  async findItemsOfMonth(userId: string, month: Date): Promise<Pick<PlanItemRow, 'doneAt'>[]> {
    const plan = await this.prisma.plan.findFirst({
      where: { userId, month },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { items: { select: { doneAt: true } } },
    });
    return plan?.items ?? [];
  }

  findItem(userId: string, key: PlanItemKey): Promise<PlanItemRow | null> {
    return key.tx.planItem.findFirst({
      where: ownedItemWhere(userId, key),
      select: PLAN_ITEM_SELECT,
    });
  }

  async updateItem(userId: string, change: PlanItemChange): Promise<PlanItemRow | null> {
    const { tx, data } = change;
    const { count } = await tx.planItem.updateMany({ where: ownedItemWhere(userId, change), data });
    if (count === 0) {
      return null;
    }
    return this.findItem(userId, change);
  }
}
