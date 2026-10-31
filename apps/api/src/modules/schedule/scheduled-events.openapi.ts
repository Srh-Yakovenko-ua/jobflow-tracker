import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type CreateScheduledEventInput,
  createScheduledEventInputSchema,
  type ScheduledEvent,
  scheduledEventIdSchema,
  scheduledEventListResponseSchema,
  scheduledEventSchema,
  scheduledEventUpdateResponseSchema,
  type UpdateScheduledEventInput,
  updateScheduledEventInputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import {
  applicationIdParams,
  errorResponses,
  EXAMPLE_CHILD_ROW,
  EXAMPLE_EDITED_AT,
  jsonContent,
} from '../../openapi/route.js';
import { icsOf } from './ics.js';
import { ICS_HEADERS } from './scheduled-events.controller.js';

export const EXAMPLE_EVENT_ID = '0199f2a1-3b4c-7d5e-8f60-7a8b9c0d1e2f';

export const EVENT_INPUT = {
  kind: 'tech_interview',
  startsAt: '2026-11-03T16:00:00+02:00',
  durationMin: 90,
  locationOrLink: 'https://meet.google.com/abc-defg-hij',
} satisfies CreateScheduledEventInput;

const SCHEDULED_EVENT = {
  ...EVENT_INPUT,
  ...EXAMPLE_CHILD_ROW,
  id: EXAMPLE_EVENT_ID,
  startsAt: '2026-11-03T14:00:00.000Z',
  status: 'planned',
  outcomeNote: null,
} satisfies ScheduledEvent;

const EVENT_PATCH = {
  status: 'done',
  outcomeNote: 'Питали про Kafka і CQRS, чекають фідбек до п’ятниці',
} satisfies UpdateScheduledEventInput;

const ICS_EXAMPLE = icsOf(
  { ...SCHEDULED_EVENT, company: 'Acme', startsAt: new Date(SCHEDULED_EVENT.startsAt) },
  new Date(EXAMPLE_EDITED_AT),
);

const EVENTS_PATH = '/applications/{id}/scheduled-events';

const EVENT_PATH = `${EVENTS_PATH}/{eventId}`;

const TAGS = ['applications'];

const eventParams = applicationIdParams.extend({
  eventId: scheduledEventIdSchema.meta({ example: EXAMPLE_EVENT_ID }),
});

const ownedErrors = errorResponses([401, 403, 404, 422]);

const bodyErrors = errorResponses([400, 401, 403, 404, 422]);

const icsHeaders = z.object({
  'Content-Disposition': z.string().meta({ example: ICS_HEADERS['Content-Disposition'] }),
});

const EVENT_ROUTES: RouteConfig[] = [
  {
    method: 'post',
    path: EVENTS_PATH,
    tags: TAGS,
    summary: 'Plan an interview or a call on an Application',
    description:
      'startsAt carries Z or an offset and is stored in UTC; durationMin defaults to 60. The event starts planned, interview_scheduled goes to the timeline, and an interview_soon reminder is armed 2 hours or 15 minutes ahead.',
    request: {
      params: applicationIdParams,
      body: { required: true, content: jsonContent(createScheduledEventInputSchema, EVENT_INPUT) },
    },
    responses: {
      201: {
        description: 'The planned event',
        content: jsonContent(scheduledEventSchema, SCHEDULED_EVENT),
      },
      ...bodyErrors,
    },
  },
  {
    method: 'get',
    path: EVENTS_PATH,
    tags: TAGS,
    summary: 'List the scheduled events of an Application',
    description: 'Every status, earliest start first.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The scheduled events of the Application',
        content: jsonContent(scheduledEventListResponseSchema, { items: [SCHEDULED_EVENT] }),
      },
      ...ownedErrors,
    },
  },
];

const SINGLE_EVENT_ROUTES: RouteConfig[] = [
  {
    method: 'patch',
    path: EVENT_PATH,
    tags: TAGS,
    summary: 'Change, reschedule, cancel or complete a scheduled event',
    description:
      'Send at least one field. planned may become done or cancelled, cancelled may become planned, done stays done; another change of status, or one that lost a race, answers 409. The change to done writes interview_done with the duration and answers suggestedStage, the next stage the Application may move to (POST /applications/{id}/events); it is null otherwise.',
    request: {
      params: eventParams,
      body: { required: true, content: jsonContent(updateScheduledEventInputSchema, EVENT_PATCH) },
    },
    responses: {
      200: {
        description: 'The changed event',
        content: jsonContent(scheduledEventUpdateResponseSchema, {
          ...SCHEDULED_EVENT,
          ...EVENT_PATCH,
          updatedAt: EXAMPLE_EDITED_AT,
          suggestedStage: 'final',
        }),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422]),
    },
  },
  {
    method: 'delete',
    path: EVENT_PATH,
    tags: TAGS,
    summary: 'Delete a scheduled event and its reminder',
    request: { params: eventParams },
    responses: { 204: { description: 'The event is deleted' }, ...ownedErrors },
  },
  {
    method: 'get',
    path: `${EVENT_PATH}/ics`,
    tags: TAGS,
    summary: 'Download a scheduled event as an .ics file',
    description: 'One VEVENT with UTC times, to import into Google Calendar or any other calendar.',
    request: { params: eventParams },
    responses: {
      200: {
        description: 'The iCalendar file',
        headers: icsHeaders,
        content: { 'text/calendar': { schema: z.string(), example: ICS_EXAMPLE } },
      },
      ...ownedErrors,
    },
  },
];

export const SCHEDULED_EVENTS_OPENAPI_PATHS: RouteConfig[] = [
  ...EVENT_ROUTES,
  ...SINGLE_EVENT_ROUTES,
];
