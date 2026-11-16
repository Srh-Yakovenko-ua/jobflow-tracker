import { type Notification, userNow, type UserSettings } from '@jobflow/shared';
import { addDays, set } from 'date-fns';

export const QUIET_HOURS_LIMITS = { urgentInterviewMinutes: 120 } as const;

export type QuietHoursSettings = Pick<
  UserSettings,
  'timezone' | 'quietHoursStart' | 'quietHoursEnd'
>;

export type QuietHoursDelivery = {
  settings: QuietHoursSettings;
  notification: Notification;
  now: Date;
};

const MINUTE_MS = 60_000;

const minuteOfDay = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));

function isUrgent(notification: Notification, now: Date): boolean {
  if (notification.type !== 'interview_soon') return false;
  const startsIn = Date.parse(notification.payload.startsAt) - now.getTime();
  return startsIn <= QUIET_HOURS_LIMITS.urgentInterviewMinutes * MINUTE_MS;
}

function isQuiet(settings: QuietHoursSettings, minute: number): boolean {
  const start = minuteOfDay(settings.quietHoursStart);
  const end = minuteOfDay(settings.quietHoursEnd);
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

function quietEndAfter(settings: QuietHoursSettings, now: Date): Date | undefined {
  const local = userNow(settings, now);
  const quiet = settings.quietHoursStart !== settings.quietHoursEnd;
  if (!quiet || !isQuiet(settings, local.getHours() * 60 + local.getMinutes())) return undefined;
  const end = minuteOfDay(settings.quietHoursEnd);
  const endToday = set(local, {
    hours: Math.floor(end / 60),
    minutes: end % 60,
    seconds: 0,
    milliseconds: 0,
  });
  return new Date((endToday > local ? endToday : addDays(endToday, 1)).getTime());
}

export type ScheduledDelivery = { deliverAt: Date; delayMs: number };

export function quietHoursDeliveryAt({ settings, notification, now }: QuietHoursDelivery): Date {
  return isUrgent(notification, now) ? now : (quietEndAfter(settings, now) ?? now);
}

export function scheduledDelivery(delivery: QuietHoursDelivery): ScheduledDelivery {
  const deliverAt = quietHoursDeliveryAt(delivery);
  return { deliverAt, delayMs: deliverAt.getTime() - delivery.now.getTime() };
}
