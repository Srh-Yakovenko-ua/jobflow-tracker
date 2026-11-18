import { tz } from '@date-fns/tz';
import { startOfDay, startOfMonth } from 'date-fns';

import { AI_SERVICE_ERRORS } from './ai-service-error.js';

export type BudgetWindow = { dayStart: Date; monthStart: Date };

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
