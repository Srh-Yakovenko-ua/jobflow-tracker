export type WallClock = { day: string; time: string };

export type ZonedWallClock = WallClock & { timeZone: string };

const MINUTE_MS = 60_000;

const MINUTES_PER_HOUR = 60;

const OFFSET_PATTERN = /GMT([+-])(\d{2}):(\d{2})/;

export function dayKeyOf(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function offsetMinutesAt(epochMs: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(epochMs)
    .find((part) => part.type === 'timeZoneName')?.value;
  const [, sign, hours, minutes] = OFFSET_PATTERN.exec(name ?? '') ?? [];
  if (sign === undefined) return 0;
  const total = Number(hours) * MINUTES_PER_HOUR + Number(minutes);
  return sign === '-' ? -total : total;
}

export function instantOf({ day, time, timeZone }: ZonedWallClock): string {
  const wall = Date.parse(`${day}T${time}:00Z`);
  const firstPass = wall - offsetMinutesAt(wall, timeZone) * MINUTE_MS;
  return new Date(wall - offsetMinutesAt(firstPass, timeZone) * MINUTE_MS).toISOString();
}

export function wallClockOf(iso: string, timeZone: string): WallClock {
  const at = Date.parse(iso);
  const shifted = new Date(at + offsetMinutesAt(at, timeZone) * MINUTE_MS).toISOString();
  return { day: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}
