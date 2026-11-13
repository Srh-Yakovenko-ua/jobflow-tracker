export const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

export type UserTimeZone = { timezone: string } | null | undefined;

export const timeZoneOf = (settings: UserTimeZone): string =>
  settings?.timezone ?? DEFAULT_TIME_ZONE;
