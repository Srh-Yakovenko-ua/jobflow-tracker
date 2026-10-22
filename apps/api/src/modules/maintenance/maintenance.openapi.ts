import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { errorResponses, jsonContent } from '../../openapi/route.js';
import { jobAcceptedSchema, PING_LIMITS, pingBodySchema } from './maintenance.jobs.js';

export const MAINTENANCE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/dev/jobs/ping',
    tags: ['dev'],
    summary: 'Queue a maintenance ping job',
    description: `development and test only; production answers 404. The worker holds the job for holdMs (at most ${String(PING_LIMITS.maxHoldMs)}).`,
    request: {
      body: { required: true, content: jsonContent(pingBodySchema, { holdMs: 1500 }) },
    },
    responses: {
      202: {
        description: 'The job is queued',
        content: jsonContent(jobAcceptedSchema, { jobId: '17' }),
      },
      ...errorResponses([400, 401, 403, 404, 422]),
    },
  },
];
