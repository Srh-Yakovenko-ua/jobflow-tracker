import { TZDate } from '@date-fns/tz';
import type { Notification } from '@jobflow/shared';
import { subDays } from 'date-fns';

import { uk } from '@/shared/i18n';
import { formatDayMonth, formatDayMonthYear } from '@/shared/lib/state-format';
import { dayKeyOf } from '@/shared/lib/zoned-time';

export type NotificationDay = Readonly<{
  key: string;
  label: string;
  notifications: readonly Notification[];
}>;

export type NotificationZone = Readonly<{ now: Date; timeZone: string }>;

export type NotificationDaysInput = Readonly<{
  notifications: readonly Notification[];
  zone: NotificationZone;
}>;

const COPY = uk.notifications.days;

const YEAR_LENGTH = 4;

function labelerOf({ now, timeZone }: NotificationZone) {
  const today = dayKeyOf(now, timeZone);
  const yesterday = dayKeyOf(subDays(new TZDate(now, timeZone), 1), timeZone);
  const labels: Record<string, string> = { [today]: COPY.today, [yesterday]: COPY.yesterday };
  return (key: string, at: Date): string => {
    const named = labels[key];
    if (named !== undefined) return named;
    const sameYear = key.slice(0, YEAR_LENGTH) === today.slice(0, YEAR_LENGTH);
    return sameYear ? formatDayMonth({ at, timeZone }) : formatDayMonthYear({ at, timeZone });
  };
}

export function notificationDaysOf({
  notifications,
  zone,
}: NotificationDaysInput): NotificationDay[] {
  const labelOf = labelerOf(zone);
  const days = new Map<string, { label: string; notifications: Notification[] }>();
  for (const notification of notifications) {
    const at = new Date(notification.createdAt);
    const key = dayKeyOf(at, zone.timeZone);
    const day = days.get(key) ?? { label: labelOf(key, at), notifications: [] };
    day.notifications.push(notification);
    days.set(key, day);
  }
  return [...days].map(([key, day]) => ({ key, ...day }));
}
