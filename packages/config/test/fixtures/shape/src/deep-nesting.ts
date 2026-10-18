export function firstLarge(values: number[]): number {
  for (const value of values) {
    if (value > 0) {
      if (value > 10) {
        if (value > 100) {
          return value;
        }
      }
    }
  }
  return 0;
}
