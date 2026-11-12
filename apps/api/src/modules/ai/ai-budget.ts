import { tz } from '@date-fns/tz';
import { AI_JOB_FAILURES } from '@jobflow/shared';
import { startOfDay, startOfMonth } from 'date-fns';

import type { BudgetWindow } from './ai.repository.js';

export const AI_BUDGET = {
  countedFailures: [AI_JOB_FAILURES.invalidOutput, AI_JOB_FAILURES.timeout],
} as const;

const IN_UTC = { in: tz('UTC') };

export function budgetWindow(now: Date): BudgetWindow {
  return {
    dayStart: new Date(startOfDay(now, IN_UTC)),
    monthStart: new Date(startOfMonth(now, IN_UTC)),
  };
}
