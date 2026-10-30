const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarDateOf(date: Date, timeZone: string): Date {
  return new Date(new Intl.DateTimeFormat('en-CA', { timeZone }).format(date));
}

export function calendarDayOf(date: Date, timeZone: string): number {
  return calendarDateOf(date, timeZone).getTime() / DAY_MS;
}
