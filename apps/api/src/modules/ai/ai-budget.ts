import type { BudgetWindow } from './ai.repository.js';

export const AI_BUDGET = { countedFailures: ['ai_invalid_output', 'ai_timeout'] } as const;

export function budgetWindow(now: Date): BudgetWindow {
  const [year, month] = [now.getUTCFullYear(), now.getUTCMonth()];
  return {
    dayStart: new Date(Date.UTC(year, month, now.getUTCDate())),
    monthStart: new Date(Date.UTC(year, month, 1)),
  };
}
