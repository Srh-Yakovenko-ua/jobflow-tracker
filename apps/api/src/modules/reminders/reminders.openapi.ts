import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  OPEN_STAGES,
  type Reminder,
  REMINDER_LIMITS,
  reminderIdSchema,
  reminderListResponseSchema,
  reminderSchema,
  type SnoozeReminderInput,
  snoozeReminderInputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, EXAMPLE_APPLICATION_ID, jsonContent } from '../../openapi/route.js';

const EXAMPLE_REMINDER_ID = '0199f2b0-1a2b-7c3d-8e4f-5a6b7c8d9e0f';

const REMINDER = {
  id: EXAMPLE_REMINDER_ID,
  applicationId: EXAMPLE_APPLICATION_ID,
  company: 'Acme',
  stage: 'tech_interview',
  type: 'followup',
  status: 'pending',
  scheduledEventId: null,
  dueAt: '2026-11-03T09:00:00.000Z',
  snoozedUntil: null,
} satisfies Reminder;

const SNOOZE = { days: 3 } satisfies SnoozeReminderInput;

const TAGS = ['reminders'];

const reminderParams = z.object({
  id: reminderIdSchema.meta({ example: EXAMPLE_REMINDER_ID }),
});

const { min, max } = REMINDER_LIMITS.snoozeDays;

const CLOSE_DESCRIPTION =
  'A pending or snoozed reminder of the signed-in user; a missing id or another user’s id answers 404, a reminder already done or dismissed answers 409.';

type CloseRoute = { action: string; summary: string; reminder: Reminder };

const closeRoute = ({ action, summary, reminder }: CloseRoute): RouteConfig => ({
  method: 'post',
  path: `/reminders/{id}/${action}`,
  tags: TAGS,
  summary,
  description: CLOSE_DESCRIPTION,
  request: { params: reminderParams },
  responses: {
    200: { description: 'The changed reminder', content: jsonContent(reminderSchema, reminder) },
    ...errorResponses([401, 403, 404, 409, 422]),
  },
});

export const REMINDERS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/reminders',
    tags: TAGS,
    summary: 'List the pending and snoozed reminders',
    description: `Follow-ups the silence scan wrote and interview reminders, of non-deleted applications whose stage is one of ${OPEN_STAGES.join(', ')}; earliest dueAt first, then id. No pagination: an application has at most one active reminder of each type and event.`,
    responses: {
      200: {
        description: 'The active reminders',
        content: jsonContent(reminderListResponseSchema, { items: [REMINDER] }),
      },
      ...errorResponses([401, 403]),
    },
  },
  closeRoute({
    action: 'done',
    summary: 'Mark a reminder done',
    reminder: { ...REMINDER, status: 'done' },
  }),
  closeRoute({
    action: 'dismiss',
    summary: 'Dismiss a reminder and wait longer',
    reminder: { ...REMINDER, status: 'dismissed' },
  }),
  {
    method: 'post',
    path: '/reminders/{id}/snooze',
    tags: TAGS,
    summary: 'Snooze a reminder for a number of days',
    description: `${CLOSE_DESCRIPTION} days is a whole number from ${String(min)} to ${String(max)}; snoozedUntil becomes now plus days, also for a reminder already snoozed.`,
    request: {
      params: reminderParams,
      body: { required: true, content: jsonContent(snoozeReminderInputSchema, SNOOZE) },
    },
    responses: {
      200: {
        description: 'The snoozed reminder',
        content: jsonContent(reminderSchema, {
          ...REMINDER,
          status: 'snoozed',
          snoozedUntil: '2026-11-06T09:00:00.000Z',
        }),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422]),
    },
  },
];
