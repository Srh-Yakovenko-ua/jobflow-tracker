import { TZDate, tzOffset } from '@date-fns/tz';
import { format, subMinutes } from 'date-fns';

export type WallClock = { day: string; time: string };

export type ZonedWallClock = WallClock & { timeZone: string };

const DAY_KEY = 'yyyy-MM-dd';

export function dayKeyOf(date: Date, timeZone: string): string {
  return format(new TZDate(date, timeZone), DAY_KEY);
}

export function instantOf({ day, time, timeZone }: ZonedWallClock): string {
  const wall = new Date(`${day}T${time}:00Z`);
  const firstPass = subMinutes(wall, tzOffset(timeZone, wall));
  return subMinutes(wall, tzOffset(timeZone, firstPass)).toISOString();
}

export function wallClockOf(iso: string, timeZone: string): WallClock {
  const zoned = new TZDate(iso, timeZone);
  return { day: format(zoned, DAY_KEY), time: format(zoned, 'HH:mm') };
}
