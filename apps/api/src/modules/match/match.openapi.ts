import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { type ApplicationMatchResponse, applicationMatchResponseSchema } from '@jobflow/shared';

import { applicationIdParams, errorResponses, jsonContent } from '../../openapi/route.js';

const MATCH = {
  match: {
    score: 65,
    matched: [
      { name: 'React + TypeScript', weight: 'must', coverage: 'full', pointsLost: 0 },
      { name: 'AWS', weight: 'must', coverage: 'partial', pointsLost: 21 },
    ],
    missing: [{ name: 'GraphQL', weight: 'nice', pointsLost: 14 }],
    ignored: [{ name: 'Домен e-commerce', coverage: 'full' }],
    explanation: 'React збігається, AWS лише частково, GraphQL немає.',
    resumeVersion: { id: '0199f1d0-3b10-7a20-8c30-4d5e6f708192', number: 2, title: 'CV v2' },
    computedAt: '2026-08-14T10:20:00.000Z',
  },
  job: { id: '0199f1d0-3b10-7a20-8c30-4d5e6f7081a3', status: 'done' },
} satisfies ApplicationMatchResponse;

export const MATCH_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications/{id}/match',
    tags: ['applications'],
    summary: 'Read the Match Score breakdown of an Application',
    description:
      'The latest done match of the Application against the resume version linked to it now. The model maps each vacancy requirement as full, partial or missing with a weight of must, nice or mentioned; the score is computed in code: must is worth 3 points, nice 1, mentioned 0, and each must or nice requirement loses its share of 100 by its missing coverage, so the score is 100 minus the listed losses. The match settle step writes match_score only for the version still linked. match is null with no linked resume version, before a match is done for that version, or after the AI results are deleted. job is the latest match ai_jobs row for the linked version by creation time, whatever its status: MatchQueueService.request writes it queued and AiService moves it to processing, done or failed. A queued or processing job newer than the shown match means a new score is being computed, and failed with no match means the last attempt failed; the queue position and step come from GET /jobs/{id}. job is null with no linked resume version or before any match job exists for that version. Read only.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The Match Score breakdown or null, and the latest match job or null',
        content: jsonContent(applicationMatchResponseSchema, MATCH),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
