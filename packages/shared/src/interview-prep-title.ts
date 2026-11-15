import { tz } from '@date-fns/tz';
import { differenceInCalendarDays, format } from 'date-fns';
import { uk } from 'date-fns/locale/uk';

import type { InterviewPrepReadyNotificationPayload } from './notifications.js';
import { SCHEDULED_EVENT_KIND_LABELS } from './scheduled-events.js';
import type { UserSettings } from './schemas/user-settings.js';

export type InterviewPrepTitleSource = {
  payload: InterviewPrepReadyNotificationPayload;
  createdAt: string;
};

const RELATIVE_DAYS = ['Сьогодні', 'Завтра'] as const;

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('uk') + text.slice(1);

export function interviewPrepTitleOf(
  { payload, createdAt }: InterviewPrepTitleSource,
  { timezone }: Pick<UserSettings, 'timezone'>,
): string {
  const inZone = { in: tz(timezone) };
  const startsAt = new Date(payload.startsAt);
  const day =
    RELATIVE_DAYS[differenceInCalendarDays(startsAt, new Date(createdAt), inZone)] ??
    format(startsAt, 'd MMMM', { ...inZone, locale: uk });
  const kind = lowerFirst(SCHEDULED_EVENT_KIND_LABELS[payload.eventKind].labelUk);
  return `${day} ${kind} в ${payload.company}`;
}
