import type { ResponseConfig, RouteConfig, ZodContentObject } from '@asteasolutions/zod-to-openapi';
import { errorResponseSchema } from '@jobflow/shared';
import { z } from 'zod';

import { ERROR_TYPES, type ErrorStatus } from '../common/app-error.js';
import { envSchema } from '../config/env.js';
import {
  DEFAULT_RATE_LIMIT_POLICY,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy,
} from '../rate-limit/rate-limit.policies.js';

export type RouteResponses = RouteConfig['responses'];

export const PUBLIC = { security: [] } satisfies Pick<RouteConfig, 'security'>;

export const EXAMPLE_REQUEST_ID = '0199f0c4-5d2e-7b31-8c4f-6a7b8c9d0e1f';

const errorResponse = errorResponseSchema.meta({ id: 'ErrorResponse' });

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
    content: jsonContent(errorResponse, { type, title, status, requestId: EXAMPLE_REQUEST_ID }),
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
