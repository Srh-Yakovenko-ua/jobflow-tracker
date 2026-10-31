const MINUTE_MS = 60_000;

export function addMinutes(at: Date, minutes: number): Date {
  return new Date(at.getTime() + minutes * MINUTE_MS);
}
