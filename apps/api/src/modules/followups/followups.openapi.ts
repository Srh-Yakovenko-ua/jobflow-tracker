import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  captureRetryResponseSchema,
  FOLLOWUP_LIMITS,
  followupRequestFieldsSchema,
  type FollowupRequestInput,
  type FollowupResponse,
  followupResponseSchema,
} from '@jobflow/shared';

import {
  applicationIdParams,
  errorResponses,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const JOB_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f2b';

const FOLLOWUP = {
  draft: {
    subject: 'Технічна співбесіда в Acme: наступний крок',
    body: 'Вітаю, Оксано! Дякую за технічну співбесіду на позицію Senior React developer в Acme...',
    generatedAt: '2026-09-10T11:00:00.000Z',
  },
  job: { id: JOB_ID, status: 'done', errorType: null },
  language: 'uk',
  silenceDays: 6,
} satisfies FollowupResponse;

const REQUEST = {
  tone: 'warm',
  language: 'uk',
  hint: "згадай, що я дорозв'язав задачу з динамічним програмуванням",
  variant: false,
} satisfies FollowupRequestInput;

export const FOLLOWUPS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications/{id}/followup',
    tags: ['applications'],
    summary: 'Read the follow-up draft of an Application',
    description:
      'The latest done follow-up draft (subject, body and when it was generated), the latest followup ai_jobs row whatever its status, the language guessed from the vacancy text (uk when it has more Cyrillic than Latin letters, else en) and the whole days since the last event. Nothing is stored beyond the AI result: draft is null before the first done job or after the AI results are deleted, job is null before the first request. Read only.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The latest draft and job or null, the guessed language and the silence days',
        content: jsonContent(followupResponseSchema, FOLLOWUP),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
  {
    method: 'post',
    path: '/applications/{id}/followup',
    tags: ['applications'],
    summary: 'Generate a follow-up draft',
    description: `Builds the follow-up input from the Application (company, position, stage, silence days), the first contact's first name, the last interview held and the user's display name, then in one transaction stores a queued followup AI job and the application.followup_requested event; the worker calls the model later. The hint is at most ${String(FOLLOWUP_LIMITS.hintMaxLength)} characters, a blank one is dropped. variant true asks for another wording: it skips the AI result cache and runs at temperature ${String(FOLLOWUP_LIMITS.variantTemperature)}. While a followup job of the Application is queued or processing it answers that job and stores nothing. Answers 409 for a draft and for an Application outside the active stages. Counts against the hourly AI limit.`,
    request: {
      params: applicationIdParams,
      headers: idempotencyHeaders,
      body: { required: true, content: jsonContent(followupRequestFieldsSchema, REQUEST) },
    },
    responses: {
      202: {
        description: 'The AI job to follow: the new one, or the one that is still running',
        content: jsonContent(captureRetryResponseSchema, { jobId: JOB_ID }),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422], 'ai'),
    },
  },
  {
    method: 'post',
    path: '/applications/{id}/followup/sent',
    tags: ['applications'],
    summary: 'Mark the follow-up as sent',
    description:
      'In one transaction records the followup_sent timeline row at the server time and closes the active follow-up reminder of the Application as done. The draft text is not stored and last_event_at does not change; the contact response time starts from this row. The Idempotency-Key header is required here, so a repeated click records one row; without it the request answers 422.',
    request: { params: applicationIdParams, headers: idempotencyHeaders.required() },
    responses: {
      204: { description: 'The follow-up is recorded as sent' },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
