import {
  type MarkNotificationsReadResponse,
  type MeResponse,
  type Notification,
  type NotificationListResponse,
  notificationSchema,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { fixtureIdOf } from './board-fixtures';
import { meRoute, meWithSettings } from './session-fixtures';

export type NotificationSeed = Pick<Notification, 'type' | 'payload'> & {
  serial: number;
  readAt?: string | null;
  createdAt?: string;
};

export type NotificationRoutesOptions = Readonly<{
  feed?: NotificationListResponse;
  more?: NotificationListResponse;
  unreadAfterRead?: number;
  listReply?: HttpResponseResolver;
}>;

export const NOTIFICATION_NOW = new Date('2026-11-14T10:00:00.000Z');

export const SILENT_LONGEST_ID = fixtureIdOf(12);

export function unreadMeRoute(unread: number, settings: Partial<MeResponse['settings']> = {}) {
  return meRoute(() =>
    HttpResponse.json<MeResponse>({ ...meWithSettings(settings), unreadNotifications: unread }),
  );
}

export function notificationIdOf(serial: number): string {
  return `0199f4b1-2c3d-7e4f-8a51-${String(serial).padStart(12, '0')}`;
}

export function buildNotification({
  serial,
  readAt = null,
  createdAt = '2026-11-14T08:30:00.000Z',
  ...rest
}: NotificationSeed): Notification {
  return notificationSchema.parse({ id: notificationIdOf(serial), readAt, createdAt, ...rest });
}

export const SILENCE_NOTIFICATION = buildNotification({
  serial: 1,
  type: 'silence',
  payload: {
    items: [
      { applicationId: fixtureIdOf(11), company: 'Acme', days: 9 },
      { applicationId: SILENT_LONGEST_ID, company: 'Kvit Software', days: 14 },
    ],
  },
});

export const INTERVIEW_NOTIFICATION = buildNotification({
  serial: 2,
  type: 'interview_soon',
  payload: {
    applicationId: fixtureIdOf(21),
    scheduledEventId: fixtureIdOf(22),
    company: 'Grammarly',
    startsAt: '2026-11-14T14:00:00.000Z',
    minutesBefore: 60,
  },
});

export const AI_DONE_NOTIFICATION = buildNotification({
  serial: 3,
  type: 'ai_done',
  readAt: '2026-11-13T19:00:00.000Z',
  createdAt: '2026-11-13T18:40:00.000Z',
  payload: { aiJobId: fixtureIdOf(31), kind: 'vacancy_parse', applicationId: fixtureIdOf(32) },
});

export const DESIGN_FEED: NotificationListResponse = {
  items: [INTERVIEW_NOTIFICATION, SILENCE_NOTIFICATION, AI_DONE_NOTIFICATION],
  nextCursor: null,
};

export function notificationRoutes({
  feed = DESIGN_FEED,
  more = { items: [], nextCursor: null },
  unreadAfterRead = 0,
  listReply,
}: NotificationRoutesOptions = {}) {
  const sent = { lists: [] as URLSearchParams[], reads: [] as unknown[] };
  const pageOf = (search: URLSearchParams) => {
    if (search.has('cursor')) return more;
    if (search.get('unread') !== 'true') return feed;
    return { ...feed, items: feed.items.filter((item) => item.readAt === null) };
  };
  const handlers = [
    http.get(apiUrl('/notifications'), (info) => {
      const search = new URL(info.request.url).searchParams;
      sent.lists.push(search);
      return listReply === undefined ? HttpResponse.json(pageOf(search)) : listReply(info);
    }),
    http.post(apiUrl('/notifications/read'), async ({ request }) => {
      sent.reads.push(await request.json());
      return HttpResponse.json<MarkNotificationsReadResponse>({ unread: unreadAfterRead });
    }),
  ];
  return { handlers, sent };
}
