import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  CALENDAR_LIMITS,
  calendarQuerySchema,
  type CalendarResponse,
  calendarResponseSchema,
} from '@jobflow/shared';

import { errorResponses, EXAMPLE_APPLICATION_ID, jsonContent } from '../../openapi/route.js';
import { EVENT_INPUT, EXAMPLE_EVENT_ID } from './scheduled-events.openapi.js';

const APPLICATION_PROPS = { applicationId: EXAMPLE_APPLICATION_ID, company: 'Acme' };

const CALENDAR = {
  items: [
    {
      id: '0199f2b0-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
      title: 'Фоллоу-ап · Acme',
      start: '2026-11-03',
      end: null,
      allDay: true,
      extendedProps: {
        ...APPLICATION_PROPS,
        type: 'followup',
        stage: 'tech_interview',
        reminderStatus: 'pending',
      },
    },
    {
      id: EXAMPLE_EVENT_ID,
      title: "Техінтерв'ю · Acme",
      start: '2026-11-03T14:00:00.000Z',
      end: '2026-11-03T15:30:00.000Z',
      allDay: false,
      extendedProps: {
        ...APPLICATION_PROPS,
        type: 'scheduled_event',
        stage: 'tech_interview',
        eventKind: 'tech_interview',
        status: 'planned',
        locationOrLink: EVENT_INPUT.locationOrLink,
      },
    },
  ],
} satisfies CalendarResponse;

export const CALENDAR_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/calendar',
    tags: ['calendar'],
    summary: 'The scheduled events and follow-up reminders in a range, shaped for FullCalendar',
    description: `from and to carry Z or an offset, to is later than from and at most ${String(CALENDAR_LIMITS.rangeMaxDays)} days on. An event is included when it overlaps [from, to) and is planned or done; start and end are UTC. A follow-up is an all-day item dated in the time zone of the user's settings.`,
    request: { query: calendarQuerySchema },
    responses: {
      200: {
        description: 'The calendar items',
        content: jsonContent(calendarResponseSchema, CALENDAR),
      },
      ...errorResponses([401, 403, 422]),
    },
  },
];
