import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { healthSchema, readinessSchema } from '@jobflow/shared';

import { errorResponses, jsonContent, PUBLIC } from '../../openapi/route.js';

export const HEALTH_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/health',
    tags: ['health'],
    summary: 'Liveness probe',
    ...PUBLIC,
    responses: {
      200: {
        description: 'The process is up',
        content: jsonContent(healthSchema, { status: 'ok' }),
      },
      ...errorResponses([]),
    },
  },
  {
    method: 'get',
    path: '/ready',
    tags: ['health'],
    summary: 'Readiness probe',
    description: 'Answers 503 while Redis or Postgres is unreachable.',
    ...PUBLIC,
    responses: {
      200: {
        description: 'Redis and Postgres answer',
        content: jsonContent(readinessSchema, {
          status: 'ok',
          checks: { redis: 'up', postgres: 'up' },
        }),
      },
      ...errorResponses([503]),
    },
  },
];
