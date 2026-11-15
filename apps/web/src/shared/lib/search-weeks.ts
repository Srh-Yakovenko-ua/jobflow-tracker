export const DAYS_IN_WEEK = 7;

export function searchWeeks(daysInSearch: number): number {
  return Math.max(1, Math.round(daysInSearch / DAYS_IN_WEEK));
}
