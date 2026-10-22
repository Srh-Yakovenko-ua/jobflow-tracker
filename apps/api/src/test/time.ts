export const NOW = new Date('2026-10-22T09:00:00.000Z');

const MINUTE_MS = 60 * 1000;

const DAY_MINUTES = 24 * 60;

export const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * MINUTE_MS);

export const minutesAfter = (minutes: number) => minutesBefore(-minutes);

export const daysBefore = (days: number) => minutesBefore(days * DAY_MINUTES);
