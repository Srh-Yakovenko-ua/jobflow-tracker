export function calendarDateOf(date: Date, timeZone: string): Date {
  return new Date(new Intl.DateTimeFormat('en-CA', { timeZone }).format(date));
}
