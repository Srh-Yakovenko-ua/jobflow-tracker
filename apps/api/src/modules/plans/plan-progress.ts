import type { PlanProgress } from '@jobflow/shared';

export function planProgressOf(items: { doneAt: Date | null }[]): PlanProgress | null {
  if (items.length === 0) {
    return null;
  }
  return { items: items.length, done: items.filter(({ doneAt }) => doneAt !== null).length };
}
