import { tz } from '@date-fns/tz';
import { startOfDay, startOfMonth } from 'date-fns';

import type { BudgetWindow } from './ai.repository.js';
import { AI_SERVICE_ERRORS } from './ai-service-error.js';

export const AI_BUDGET = {
  countedFailures: [AI_SERVICE_ERRORS.invalidOutput, AI_SERVICE_ERRORS.timeout],
} as const;

const IN_UTC = { in: tz('UTC') };

export function budgetWindow(now: Date): BudgetWindow {
  return {
    dayStart: new Date(startOfDay(now, IN_UTC)),
    monthStart: new Date(startOfMonth(now, IN_UTC)),
  };
}
