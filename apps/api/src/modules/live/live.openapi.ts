import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  LIVE_EVENTS,
  LIVE_LIMITS,
  liveStreamQuerySchema,
  type LiveTicket,
  liveTicketSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, jsonContent, PUBLIC } from '../../openapi/route.js';
import { UNLIMITED_ROUTE } from '../../rate-limit/rate-limit.policies.js';

const TAGS = ['live'];

const TICKET = {
  ticket: 'Zr1pQ0c3vJm8sN2xLk5yT7uWb4aHd6eFg9iKoP1qRsU',
  expiresInSeconds: LIVE_LIMITS.ticketTtlSeconds,
} satisfies LiveTicket;

const streamQuery = liveStreamQuerySchema.extend({
  ticket: liveStreamQuerySchema.shape.ticket.meta({
    description:
      'The ticket from POST /events/ticket, written by LiveTicketsService.issue. It opens one stream once.',
    example: TICKET.ticket,
  }),
});

const STREAM_EXAMPLE = [
  'id: 0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1b',
  `event: ${LIVE_EVENTS.jobUpdated}`,
  'data: {"id":"0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a","kind":"vacancy_parse","status":"done","step":3,"errorType":null,"applicationId":"0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2a"}',
  '',
  ': heartbeat',
  '',
  '',
].join('\n');

const EVENT_NAMES = Object.values(LIVE_EVENTS).join(', ');

export const LIVE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/events/ticket',
    tags: TAGS,
    summary: 'Issue a one-time ticket for the live stream',
    description: `EventSource cannot send an Authorization header, so the client asks for a ticket with its access token and opens the stream with the ticket. LiveTicketsService.issue stores only the SHA-256 of the ticket in Redis for ${String(LIVE_LIMITS.ticketTtlSeconds)} s, and the first stream that presents it deletes it. A capture token answers 403. Answers 503 while Redis is not reachable; the client then polls GET /jobs/{id} every ${String(LIVE_LIMITS.pollFallbackMs)} ms.`,
    responses: {
      201: {
        description: 'The ticket and its lifetime in seconds',
        content: jsonContent(liveTicketSchema, TICKET),
      },
      ...errorResponses([401, 403, 503]),
    },
  },
  {
    method: 'get',
    path: '/events/stream',
    tags: TAGS,
    summary: 'Live updates of the signed-in user as Server-Sent Events',
    description: `Takes the ticket that LiveTicketsService.issue wrote, not an access token. Pushes ${EVENT_NAMES} of the ticket's user, each with a uuid id, the event name and a JSON data line: job.updated carries the job status without queue and totalSteps, application.updated carries applicationId and the changed fields, notification.created carries notificationId. A comment line ": heartbeat" follows every ${String(LIVE_LIMITS.heartbeatSeconds)} s and carries no id. The server ends the stream after ${String(LIVE_LIMITS.streamMaxSeconds)} s, on shutdown and when Redis stops answering; the client asks for a new ticket, reconnects and refetches, because Last-Event-ID is not replayed. A missing, unknown, used or expired ticket answers 401, Redis out of reach answers 503. The route is outside RateLimitInterceptor: every open follows the rate limited POST /events/ticket.`,
    ...PUBLIC,
    request: { query: streamQuery },
    responses: {
      200: {
        description: 'The open event stream',
        content: { 'text/event-stream': { schema: z.string(), example: STREAM_EXAMPLE } },
      },
      ...errorResponses([401, 503], UNLIMITED_ROUTE),
    },
  },
];
