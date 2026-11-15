import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type DeleteAccountInput,
  deleteAccountInputSchema,
  EXPORT_LIMITS,
  exportAcceptedSchema,
  type ExportLink,
  exportLinkSchema,
  type ExportRequest,
  exportRequestSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, idempotencyHeaders, jsonContent } from '../../openapi/route.js';
import { REFRESH_COOKIE } from '../auth/index.js';

const TAGS = ['account'];

const EXPORT_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c3e';

const EXPORT_REQUEST = { format: 'csv' } satisfies ExportRequest;

const EXPORT_LINK = {
  status: 'ready',
  url: `http://localhost:9000/resumes/users/0199f0a0-0000-7000-8000-000000000001/exports/${EXPORT_ID}.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${String(EXPORT_LIMITS.linkTtlSeconds)}&response-content-type=application%2Fzip&X-Amz-Signature=9e107d9d372bb6826bd81d3542a419d6`,
  expiresAt: '2026-11-15T11:00:00.000Z',
} satisfies ExportLink;

const exportParams = z.object({
  exportId: exportAcceptedSchema.shape.exportId.meta({ example: EXPORT_ID }),
});

const DELETE_ACCOUNT = { password: 'olena-password-1' } satisfies DeleteAccountInput;

const clearedRefreshCookie = z.object({
  'Set-Cookie': z.string().meta({ description: `Clears the ${REFRESH_COOKIE} cookie` }),
});

const LINK_TTL_MINUTES = String(EXPORT_LIMITS.linkTtlSeconds / 60);

export const ACCOUNT_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'delete',
    path: '/me',
    tags: TAGS,
    summary: 'Delete my account and all of my data',
    description:
      'Confirms the account with its password; an account signed up through Google or GitHub, which has no password, types its own email into the same field. Removes every file of the user from the file storage first, so a 503 leaves the account whole for a retry, then deletes the user with every row it owns and its outbox events in one transaction. Every refresh token goes with it, so a refresh answers 401; an access token stays valid until it expires and finds nothing.',
    request: {
      body: {
        required: true,
        description: 'The password, or the email of an account without one.',
        content: jsonContent(deleteAccountInputSchema, DELETE_ACCOUNT),
      },
    },
    responses: {
      204: {
        description: 'The account and all of its data are deleted',
        headers: clearedRefreshCookie,
      },
      ...errorResponses([400, 401, 403, 422, 503], 'login'),
    },
  },
  {
    method: 'post',
    path: '/me/export',
    tags: TAGS,
    summary: 'Export all of my data',
    description:
      'Writes the export.requested event and answers its export id at once; the worker builds one zip of applications, stage_events (effective moves with the reason code and its label), contacts, notes and resume_versions (metadata only), each as csv or json, stores it under the user, removes the older export and records an export_ready notification. Drafts and deleted applications are left out. The applications file starts with the columns of the import template, stage_history included, so the zip imports back into a fresh account.',
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: 'The file format: csv or json.',
        content: jsonContent(exportRequestSchema, EXPORT_REQUEST),
      },
    },
    responses: {
      202: {
        description: 'The export to follow',
        content: jsonContent(exportAcceptedSchema, { exportId: EXPORT_ID }),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422]),
    },
  },
  {
    method: 'get',
    path: '/me/exports/{exportId}',
    tags: TAGS,
    summary: 'Read the download link of an export',
    description: `Status ready with a signed link to the zip valid ${LINK_TTL_MINUTES} minutes, signed again on every read, with the file name jobflow-export-<date>.zip. Status pending, without a link, while the zip of the latest export is not built yet. Answers 404 to an export never requested, one a newer export replaced, and an export of another user. Answers 503 when the file storage does not answer within its limit.`,
    request: { params: exportParams },
    responses: {
      200: {
        description: 'The signed download link, or pending while the zip is built',
        content: jsonContent(exportLinkSchema, EXPORT_LINK),
      },
      ...errorResponses([401, 403, 404, 422, 503]),
    },
  },
];
