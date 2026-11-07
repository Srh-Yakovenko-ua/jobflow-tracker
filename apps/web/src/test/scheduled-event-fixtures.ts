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

import { apiUrl } from './api-handlers';
import { ACME_APPLICATION } from './application-fixtures';
import { fixtureIdOf, heldReply, type MoveRouteOptions } from './board-fixtures';
import {
  storedListRoute,
  type StoredRouteOptions,
  storedRoutes,
  type StoredRoutesSetup,
  type StoredRoutesSpec,
} from './stored-routes';

export type ScheduledEventSeed = Pick<ScheduledEvent, 'startsAt'> & Partial<ScheduledEvent>;

export type ScheduledEventStore = ScheduledEvent[];

export type ScheduledEventUpdateOptions = MoveRouteOptions & { suggestedStage?: Stage | null };

export type ScheduledEventRoutesOptions = StoredRoutesSetup<ScheduledEvent> & {
  update?: ScheduledEventUpdateOptions;
  ics?: MoveRouteOptions;
};

type EventParams = { id: string; eventId: string };

const EVENTS_PATH = '/applications/:id/scheduled-events';

const EVENTS_LISTING = {
  path: EVENTS_PATH,
  pageOf: (items: ScheduledEvent[]): ScheduledEventListResponse => ({ items }),
};

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

export function scheduledEventsRoute(options: StoredRouteOptions<ScheduledEvent>) {
  return storedListRoute({ ...EVENTS_LISTING, ...options });
}

function eventsSpec(
  suggestedStage: Stage | null,
): StoredRoutesSpec<ScheduledEvent, CreateScheduledEventInput, UpdateScheduledEventInput> {
  return {
    ...EVENTS_LISTING,
    creating: {
      schema: createScheduledEventInputSchema,
      build: ({ body, ...ids }) =>
        scheduledEventOf({
          ...ids,
          kind: body.kind,
          startsAt: utcOf(body.startsAt),
          durationMin: body.durationMin ?? SLOT_DEFAULTS.durationMin,
          locationOrLink: body.locationOrLink ?? SLOT_DEFAULTS.locationOrLink,
        }),
    },
    updating: {
      schema: updateScheduledEventInputSchema,
      merge: ({ stored, patch }) => {
        const startsAt = patch.startsAt === undefined ? stored.startsAt : utcOf(patch.startsAt);
        return scheduledEventSchema.parse({ ...stored, ...patch, startsAt });
      },
      replyOf: (event): ScheduledEventUpdateResponse => ({ ...event, suggestedStage }),
    },
  };
}

export function scheduledEventIcsRoute(control: MoveRouteOptions = {}) {
  const sent: { eventId: string; authorization: string | null; accept: string | null }[] = [];
  const handler = http.get<EventParams>(apiUrl(`${EVENTS_PATH}/:eventId/ics`), (info) => {
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
  update: { suggestedStage = null, ...update } = {},
  ics = {},
  ...options
}: ScheduledEventRoutesOptions = {}) {
  const stored = storedRoutes(eventsSpec(suggestedStage), { ...options, update });
  const downloaded = scheduledEventIcsRoute(ics);
  return {
    store: stored.store,
    handlers: [...stored.handlers, downloaded.handler],
    sent: { ...stored.sent, downloaded: downloaded.sent },
  };
}
