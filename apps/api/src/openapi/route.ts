import type { ResponseConfig, RouteConfig, ZodContentObject } from '@asteasolutions/zod-to-openapi';
import { applicationIdSchema, errorResponseSchema, type UserSettings } from '@jobflow/shared';
import { z } from 'zod';

import { ERROR_TYPES, type ErrorBody, type ErrorStatus } from '../common/app-error.js';
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
  activeResumeVersionId: '0199f0b3-2b3c-7d4e-9f50-6b7c8d9e0f1a',
} satisfies UserSettings;

export const applicationIdParams = z.object({
  id: applicationIdSchema.meta({ example: EXAMPLE_APPLICATION_ID }),
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

function errorReply(status: ErrorStatus): ResponseConfig {
  const { type, title } = ERROR_TYPES[status];
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

export function errorResponses(
  statuses: ErrorStatus[],
  policy: RateLimitPolicy = DEFAULT_RATE_LIMIT_POLICY,
): RouteResponses {
  return {
    ...Object.fromEntries(statuses.map((status) => [status, errorReply(status)])),
    429: {
      ...errorReply(429),
      description: rateLimitDescription(policy),
      headers: retryAfterHeaders,
    },
    500: errorReply(500),
  };
}
