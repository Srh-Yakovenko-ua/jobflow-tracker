export const PERCENT = 100;

export function percentOf(fraction: number): number {
  return Math.round(fraction * PERCENT);
}
