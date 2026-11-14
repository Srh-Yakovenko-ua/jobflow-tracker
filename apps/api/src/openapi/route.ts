import type { ResponseConfig, RouteConfig, ZodContentObject } from '@asteasolutions/zod-to-openapi';
import { applicationIdSchema, errorResponseSchema, type UserSettings } from '@jobflow/shared';
import { z } from 'zod';

import {
  ERROR_TYPES,
  type ErrorBody,
  type ErrorStatus,
  IDEMPOTENCY_CONFLICT,
} from '../common/app-error.js';
import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_LIMITS,
  idempotencyKeySchema,
} from '../common/idempotency/idempotency-request.js';
import { envSchema } from '../config/env.js';
import {
  DEFAULT_RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
} from '../rate-limit/rate-limit.policies.js';

export type RouteResponses = RouteConfig['responses'];

export const PUBLIC = { security: [] } satisfies Pick<RouteConfig, 'security'>;

export const EXAMPLE_REQUEST_ID = '0199f0c4-5d2e-7b31-8c4f-6a7b8c9d0e1f';

export const EXAMPLE_APPLICATION_ID = '0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2a';

export const EXAMPLE_SEARCH_ID = '0199f0b2-1a2b-7c3d-8e4f-5a6b7c8d9e0f';

export const EXAMPLE_UPLOAD_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

export const EXAMPLE_RESUME_VERSION_ID = '0199f0b3-2b3c-7d4e-9f50-6b7c8d9e0f1a';

export const EXAMPLE_CHILD_ROW = {
  applicationId: EXAMPLE_APPLICATION_ID,
  createdAt: '2026-10-23T18:05:00.000Z',
  updatedAt: '2026-10-23T18:05:00.000Z',
};

export const EXAMPLE_EDITED_AT = '2026-10-24T07:40:00.000Z';

export const EXAMPLE_USER_SETTINGS = {
  silenceDays: 10,
  autoGhostDays: 45,
  askRejectionReason: false,
  monthlySummaryEnabled: false,
  theme: 'dark',
  timezone: 'Europe/Kyiv',
  quietHoursStart: '23:00',
  quietHoursEnd: '07:30',
  notifyInApp: true,
  notifyPush: true,
  notifyEmail: false,
  analyticsOptOut: true,
  singleKeyShortcuts: false,
  activeResumeVersionId: EXAMPLE_RESUME_VERSION_ID,
} satisfies UserSettings;

export const applicationIdParams = z.object({
  id: applicationIdSchema.meta({ example: EXAMPLE_APPLICATION_ID }),
});

const REPLAY_WINDOW_HOURS = IDEMPOTENCY_LIMITS.replayWindowMinutes / 60;

export const idempotencyHeaders = z.object({
  [IDEMPOTENCY_HEADER]: idempotencyKeySchema.optional().meta({
    description: `One key per submit, kept on its retries, 1 to ${String(IDEMPOTENCY_LIMITS.keyMaxLength)} characters. The same key with the same request within ${String(REPLAY_WINDOW_HOURS)} hours answers the first reply again and creates nothing; with another request, or while the first one still runs, it answers 409 with type ${IDEMPOTENCY_CONFLICT.type}. A request that fails keeps nothing, so its retry runs again.`,
    example: '0199f3a0-1b2c-7d3e-8f40-5a6b7c8d9e0f',
  }),
});

const errorResponse = errorResponseSchema.meta({ id: 'ErrorResponse' });

const EXAMPLE_DETAILS: Partial<Record<ErrorStatus, Pick<ErrorBody, 'detail' | 'errors'>>> = {
  400: { detail: 'Unexpected end of JSON input' },
  422: {
    errors: [{ path: 'email', message: 'Invalid input: expected string, received undefined' }],
  },
};

const retryAfterHeaders = z.object({
  'Retry-After': z.int().positive().meta({ description: 'Seconds until the limit window resets' }),
});

export function jsonContent<Schema extends z.ZodType>(
  schema: Schema,
  example: z.input<Schema>,
): ZodContentObject {
  return { 'application/json': { schema, example } };
}

function errorReply(
  status: ErrorStatus,
  { type, title }: Pick<ErrorBody, 'type' | 'title'> = ERROR_TYPES[status],
): ResponseConfig {
  return {
    description: title,
    content: jsonContent(errorResponse, {
      type,
      title,
      status,
      ...EXAMPLE_DETAILS[status],
      requestId: EXAMPLE_REQUEST_ID,
    }),
  };
}

function rateLimitDescription(policy: RateLimitPolicy): string {
  const { envKey, durationSeconds } = RATE_LIMIT_POLICIES[policy];
  const limit = envSchema.shape[envKey].parse(undefined);
  return `${ERROR_TYPES[429].title}: ${String(limit)} per ${String(durationSeconds)} s by default (${envKey})`;
}

function rateLimitReply(policy: RateLimitPolicy): RouteResponses {
  return {
    429: {
      ...errorReply(429),
      description: rateLimitDescription(policy),
      headers: retryAfterHeaders,
    },
  };
}

export const idempotencyConflictReply: RouteResponses = {
  409: errorReply(409, IDEMPOTENCY_CONFLICT),
};

export function errorResponses(
  statuses: ErrorStatus[],
  policy: RateLimitPolicy = DEFAULT_RATE_LIMIT_POLICY,
): RouteResponses {
  return {
    ...Object.fromEntries(statuses.map((status) => [status, errorReply(status)])),
    ...rateLimitReply(policy),
    500: errorReply(500),
  };
}
