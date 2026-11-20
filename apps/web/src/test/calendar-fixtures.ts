import {
  type CalendarItem,
  calendarItemSchema,
  calendarQuerySchema,
  type CalendarResponse,
  SCHEDULED_EVENT_KIND_LABELS,
  type ScheduledEventKind,
  type ScheduledEventStatus,
  type Stage,
} from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { uk } from '@/shared/i18n';

import { apiUrl } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf, heldReply, type MoveRouteOptions } from './board-fixtures';

export type ScheduledItemSeed = {
  serial: number;
  kind: ScheduledEventKind;
  start: string;
  stage?: Stage;
  status?: ScheduledEventStatus;
};

export type FollowupItemSeed = { serial: number; date: string; stage?: Stage };

export type CalendarRouteOptions = MoveRouteOptions & { items?: readonly CalendarItem[] };

const HOUR_MS = 3_600_000;

const ACME = { applicationId: ACME_APPLICATION.id, company: ACME_APPLICATION.company } as const;

export const KYIV_WEEK = { from: '2026-11-01T22:00:00.000Z', to: '2026-11-08T22:00:00.000Z' };

export function scheduledItemOf({
  serial,
  kind,
  start,
  stage = 'tech_interview',
  status = 'planned',
}: ScheduledItemSeed): CalendarItem {
  return calendarItemSchema.parse({
    id: fixtureIdOf(serial),
    title: `${SCHEDULED_EVENT_KIND_LABELS[kind].labelUk} · ${ACME.company}`,
    start,
    end: new Date(Date.parse(start) + HOUR_MS).toISOString(),
    allDay: false,
    extendedProps: {
      ...ACME,
      type: 'scheduled_event',
      stage,
      eventKind: kind,
      status,
      locationOrLink: null,
    },
  });
}

export function followupItemOf({
  serial,
  date,
  stage = 'screening',
}: FollowupItemSeed): CalendarItem {
  return calendarItemSchema.parse({
    id: fixtureIdOf(serial),
    title: `${uk.calendarPage.legend.followup} · ${ACME.company}`,
    start: date,
    end: null,
    allDay: true,
    extendedProps: { ...ACME, type: 'followup', stage, reminderStatus: 'pending' },
  });
}

export function autoGhostItemOf(seed: FollowupItemSeed): CalendarItem {
  const followup = followupItemOf(seed);
  return calendarItemSchema.parse({
    ...followup,
    title: `Ghost за 30 днів · ${ACME.company}`,
    extendedProps: { ...ACME, type: 'auto_ghost', stage: followup.extendedProps.stage },
  });
}

export const FOLLOWUP_ITEM = followupItemOf({ serial: 701, date: '2026-11-04' });

export const AUTO_GHOST_ITEM = autoGhostItemOf({ serial: 801, date: '2026-11-05' });

export type DropSeed = { item: CalendarItem; start: string; allDay?: boolean };

export function droppedAt({ item, start, allDay = item.allDay }: DropSeed) {
  return { id: item.id, start: new Date(start), allDay, extendedProps: item.extendedProps };
}

export function calendarRoute({ items = [], ...control }: CalendarRouteOptions = {}) {
  const sent: Record<string, string>[] = [];
  const handler = http.get(apiUrl('/calendar'), (info) => {
    const query = Object.fromEntries(new URL(info.request.url).searchParams);
    sent.push(query);
    calendarQuerySchema.parse(query);
    const listed = () => HttpResponse.json<CalendarResponse>({ items: [...items] });
    return heldReply({ ...control, info, fallback: listed });
  });
  return { handler, sent };
}
