import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type CaptureTokenCreated,
  captureTokenCreatedSchema,
  captureTokenIdSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, jsonContent } from '../../openapi/route.js';

const TAGS = ['capture'];

const EXAMPLE_CAPTURE_TOKEN_ID = '0199f4c2-3d4e-7f50-8a61-7c8d9e0f1a2b';

const CREATED = {
  id: EXAMPLE_CAPTURE_TOKEN_ID,
  token: 'capture-token-shown-once',
  createdAt: '2026-11-10T09:15:00.000Z',
} satisfies CaptureTokenCreated;

const captureTokenParams = z.object({
  id: captureTokenIdSchema.meta({ example: EXAMPLE_CAPTURE_TOKEN_ID }),
});

export const CAPTURE_TOKENS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/capture/tokens',
    tags: TAGS,
    summary: 'Create the capture token of the bookmarklet',
    description:
      'Revokes the capture token the user had and stores a new one as a SHA-256 hash, in one transaction. The token is in this reply only; it is sent as "Authorization: Capture <token>" and opens POST /capture/bookmarklet alone.',
    responses: {
      201: {
        description: 'The new capture token, shown once',
        content: jsonContent(captureTokenCreatedSchema, CREATED),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'delete',
    path: '/capture/tokens/{id}',
    tags: TAGS,
    summary: 'Revoke a capture token',
    description:
      'A revoked token answers 401 on POST /capture/bookmarklet. Answers 404 for a token that is already revoked.',
    request: { params: captureTokenParams },
    responses: {
      204: { description: 'The capture token is revoked' },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
