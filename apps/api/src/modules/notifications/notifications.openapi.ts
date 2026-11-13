import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type MarkNotificationsReadInput,
  markNotificationsReadInputSchema,
  markNotificationsReadResponseSchema,
  type Notification,
  NOTIFICATION_LIMITS,
  notificationListQuerySchema,
  notificationListResponseSchema,
} from '@jobflow/shared';

import { errorResponses, EXAMPLE_APPLICATION_ID, jsonContent } from '../../openapi/route.js';

const TAGS = ['notifications'];

const NOTIFICATIONS_PATH = '/notifications';

const SILENCE: Notification = {
  id: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1c',
  type: 'silence',
  payload: { items: [{ applicationId: EXAMPLE_APPLICATION_ID, company: 'Acme', days: 7 }] },
  readAt: null,
  createdAt: '2026-11-03T09:00:00.000Z',
};

const READ_IDS = { ids: [SILENCE.id] } satisfies MarkNotificationsReadInput;

const listQuery = notificationListQuerySchema.safeExtend({
  cursor: notificationListQuerySchema.shape.cursor.meta({
    description: 'The nextCursor of the previous page; anything but a uuid answers 422 at cursor',
  }),
  unread: notificationListQuerySchema.shape.unread.meta({
    description: 'true keeps the unread notifications only, false the read ones only',
  }),
});

export const NOTIFICATIONS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: NOTIFICATIONS_PATH,
    tags: TAGS,
    summary: 'List the notifications of the signed-in user',
    description: 'Newest first. Pages follow nextCursor until it is null.',
    request: { query: listQuery },
    responses: {
      200: {
        description: 'One page of notifications',
        content: jsonContent(notificationListResponseSchema, {
          items: [SILENCE],
          nextCursor: null,
        }),
      },
      ...errorResponses([401, 403, 422]),
    },
  },
  {
    method: 'post',
    path: `${NOTIFICATIONS_PATH}/read`,
    tags: TAGS,
    summary: 'Mark notifications read',
    description: `ids marks 1 to ${String(NOTIFICATION_LIMITS.readIdsMax)} notifications, all: true marks every unread one. Unknown ids, ids of another user and notifications already read are skipped. Answers the unread count after the change.`,
    request: {
      body: { required: true, content: jsonContent(markNotificationsReadInputSchema, READ_IDS) },
    },
    responses: {
      200: {
        description: 'The unread count after the change',
        content: jsonContent(markNotificationsReadResponseSchema, { unread: 0 }),
      },
      ...errorResponses([400, 401, 403, 422]),
    },
  },
];
