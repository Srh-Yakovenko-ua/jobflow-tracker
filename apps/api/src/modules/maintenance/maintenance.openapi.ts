import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { errorResponses, jsonContent } from '../../openapi/route.js';
import {
  jobAcceptedSchema,
  PING_LIMITS,
  pingBodySchema,
  scheduleParamsSchema,
} from './maintenance.jobs.js';

const jobQueued = {
  description: 'The job is queued',
  content: jsonContent(jobAcceptedSchema, { jobId: '17' }),
};

export const MAINTENANCE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/dev/jobs/ping',
    tags: ['dev'],
    summary: 'Queue a maintenance ping job',
    description: `development and test only; production answers 404. The worker holds the job for holdMs (at most ${String(PING_LIMITS.maxHoldMs)}). Answers 503 while Redis is not reachable.`,
    request: {
      body: { required: true, content: jsonContent(pingBodySchema, { holdMs: 1500 }) },
    },
    responses: { 202: jobQueued, ...errorResponses([400, 401, 403, 404, 422, 503]) },
  },
  {
    method: 'post',
    path: '/dev/jobs/{schedule}',
    tags: ['dev'],
    summary: 'Run a scheduled maintenance job now',
    description:
      'development and test only; production answers 404. Queues one run of the job behind the named scheduler, carrying the requestId, next to its regular schedule. Answers 503 while Redis is not reachable.',
    request: { params: scheduleParamsSchema },
    responses: { 202: jobQueued, ...errorResponses([401, 403, 404, 422, 503]) },
  },
];
