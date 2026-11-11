import { AI_JOB_FAILURES } from '@jobflow/shared';

import type { BudgetWindow } from './ai.repository.js';

export const AI_BUDGET = {
  countedFailures: [AI_JOB_FAILURES.invalidOutput, AI_JOB_FAILURES.timeout],
} as const;

export function budgetWindow(now: Date): BudgetWindow {
  const [year, month] = [now.getUTCFullYear(), now.getUTCMonth()];
  return {
    dayStart: new Date(Date.UTC(year, month, now.getUTCDate())),
    monthStart: new Date(Date.UTC(year, month, 1)),
  };
}
