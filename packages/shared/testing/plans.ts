import type { Plan } from '../src/schemas/plan.js';
import { buildMonthlySummaryOutput } from './monthly-summary.js';

const PLAN_ID = '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f00';

const planItemIdOf = (position: number) => `0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f1${String(position)}`;

export function buildPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: PLAN_ID,
    title: 'План на вересень',
    month: '2026-09-01',
    aiResultId: '0199f1a2-7c3b-7d4e-8f50-6a7b8c9d0f01',
    createdAt: '2026-09-01T04:00:00.000Z',
    items: buildMonthlySummaryOutput().actions.map((action, position) => ({
      id: planItemIdOf(position),
      position,
      ...action,
      dueAt: null,
      doneAt: null,
    })),
    ...overrides,
  };
}
