import {
  type BoardCard,
  type CreateScheduledEventInput,
  createScheduledEventInputSchema,
  type ScheduledEvent,
  type ScheduledEventListResponse,
  scheduledEventSchema,
  type ScheduledEventUpdateResponse,
  type Stage,
  type UpdateScheduledEventInput,
  updateScheduledEventInputSchema,
} from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, errorReply } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf, heldReply, type MoveRouteOptions } from './board-fixtures';

export type ScheduledEventSeed = Pick<ScheduledEvent, 'startsAt'> & Partial<ScheduledEvent>;

export type ScheduledEventStore = ScheduledEvent[];

export type StoredRouteOptions = MoveRouteOptions & { store: ScheduledEventStore };

export type ScheduledEventUpdateOptions = MoveRouteOptions & { suggestedStage?: Stage | null };

export type ScheduledEventRoutesOptions = {
  items?: readonly ScheduledEvent[];
  list?: MoveRouteOptions;
  create?: MoveRouteOptions;
  update?: ScheduledEventUpdateOptions;
  ics?: MoveRouteOptions;
};

type EventParams = { id: string; eventId: string };

const EVENTS_PATH = '/applications/:id/scheduled-events';

const EVENT_PATH = `${EVENTS_PATH}/:eventId`;

const CREATED_SERIAL_FROM = 520;

const SLOT_DEFAULTS = { durationMin: 60, locationOrLink: null } as const;

export const SCHEDULED_EVENT_ID = fixtureIdOf(501);

export const SCHEDULED_EVENT_ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//JobFlow//Schedule//UK',
  'BEGIN:VEVENT',
  `UID:${SCHEDULED_EVENT_ID}@jobflow`,
  'DTSTART:20261106T140000Z',
  'DURATION:PT60M',
  'SUMMARY:Acme Technologies',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n');

export function scheduledEventOf(seed: ScheduledEventSeed): ScheduledEvent {
  return scheduledEventSchema.parse({
    id: SCHEDULED_EVENT_ID,
    applicationId: ACME_APPLICATION.id,
    kind: 'tech_interview',
    ...SLOT_DEFAULTS,
    status: 'planned',
    outcomeNote: null,
    createdAt: ACME_APPLICATION.createdAt,
    updatedAt: ACME_APPLICATION.createdAt,
    ...seed,
  });
}

function utcOf(startsAt: string): string {
  return new Date(startsAt).toISOString();
}

export function nextSlotOf(events: readonly ScheduledEvent[]): BoardCard['nextScheduledEvent'] {
  const now = Date.now();
  const [next] = events
    .filter((event) => event.status === 'planned' && Date.parse(event.startsAt) >= now)
    .sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));
  return next === undefined ? null : { kind: next.kind, startsAt: next.startsAt };
}

export function liveCardOf({
  applicationId,
  store,
}: {
  applicationId: string;
  store: ScheduledEventStore;
}) {
  return (card: BoardCard): BoardCard =>
    card.id !== applicationId || store.length === 0
      ? card
      : { ...card, nextScheduledEvent: nextSlotOf(store) };
}

export function scheduledEventsRoute({ store, ...control }: StoredRouteOptions) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl(EVENTS_PATH), (info) => {
    sent.push(info.params.id);
    const list = (): Response => {
      const response: ScheduledEventListResponse = { items: [...store] };
      return HttpResponse.json(response);
    };
    return heldReply({ ...control, info, fallback: list });
  });
  return { handler, sent };
}

export function scheduledEventCreateRoute({ store, ...control }: StoredRouteOptions) {
  const sent: { id: string; body: CreateScheduledEventInput }[] = [];
  const handler = http.post<{ id: string }>(apiUrl(EVENTS_PATH), async (info) => {
    const body = createScheduledEventInputSchema.parse(await info.request.json());
    sent.push({ id: info.params.id, body });
    const created = () => {
      const event = scheduledEventOf({
        id: fixtureIdOf(CREATED_SERIAL_FROM + store.length),
        applicationId: info.params.id,
        kind: body.kind,
        startsAt: utcOf(body.startsAt),
        durationMin: body.durationMin ?? SLOT_DEFAULTS.durationMin,
        locationOrLink: body.locationOrLink ?? SLOT_DEFAULTS.locationOrLink,
      });
      store.push(event);
      return HttpResponse.json(event, { status: 201 });
    };
    return heldReply({ ...control, info, fallback: created });
  });
  return { handler, sent };
}

export function scheduledEventUpdateRoute({
  store,
  suggestedStage = null,
  ...control
}: StoredRouteOptions & ScheduledEventUpdateOptions) {
  const sent: { eventId: string; body: UpdateScheduledEventInput }[] = [];
  const handler = http.patch<EventParams>(apiUrl(EVENT_PATH), async (info) => {
    const body = updateScheduledEventInputSchema.parse(await info.request.json());
    const { eventId } = info.params;
    sent.push({ eventId, body });
    const updated = () => {
      const index = store.findIndex((event) => event.id === eventId);
      const stored = store[index];
      if (stored === undefined) return errorReply({ status: 404, type: 'not_found' });
      const startsAt = body.startsAt === undefined ? stored.startsAt : utcOf(body.startsAt);
      const event = scheduledEventSchema.parse({ ...stored, ...body, startsAt });
      store.splice(index, 1, event);
      const response: ScheduledEventUpdateResponse = { ...event, suggestedStage };
      return HttpResponse.json(response);
    };
    return heldReply({ ...control, info, fallback: updated });
  });
  return { handler, sent };
}

export function scheduledEventIcsRoute(control: MoveRouteOptions = {}) {
  const sent: { eventId: string; authorization: string | null; accept: string | null }[] = [];
  const handler = http.get<EventParams>(apiUrl(`${EVENT_PATH}/ics`), (info) => {
    sent.push({
      eventId: info.params.eventId,
      authorization: info.request.headers.get('authorization'),
      accept: info.request.headers.get('accept'),
    });
    const ics = () =>
      new HttpResponse(SCHEDULED_EVENT_ICS, {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
      });
    return heldReply({ ...control, info, fallback: ics });
  });
  return { handler, sent };
}

export function scheduledEventRoutes({
  items = [],
  list = {},
  create = {},
  update = {},
  ics = {},
}: ScheduledEventRoutesOptions = {}) {
  const store: ScheduledEventStore = [...items];
  const listed = scheduledEventsRoute({ store, ...list });
  const created = scheduledEventCreateRoute({ store, ...create });
  const updated = scheduledEventUpdateRoute({ store, ...update });
  const downloaded = scheduledEventIcsRoute(ics);
  return {
    store,
    handlers: [listed.handler, created.handler, updated.handler, downloaded.handler],
    sent: {
      listed: listed.sent,
      created: created.sent,
      updated: updated.sent,
      downloaded: downloaded.sent,
    },
  };
}
