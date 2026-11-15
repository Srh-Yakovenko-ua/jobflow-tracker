import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  captureRetryResponseSchema,
  CV_HINTS_LIMITS,
  type CvHintsResponse,
  cvHintsResponseSchema,
} from '@jobflow/shared';

import {
  applicationIdParams,
  errorResponses,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const JOB_ID = '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f3c';

const CV_HINTS = {
  result: {
    hints: [
      {
        requirement: 'GraphQL',
        evidenceInCv: 'Added a GraphQL gateway for the mobile client',
        suggestion:
          'Підніми рядок про GraphQL-шлюз для мобільного клієнта в перший пункт останньої посади і назви, які запити він обслуговував.',
        expectedScoreImpact: 5,
      },
    ],
    gaps: ['AWS / інфраструктура', 'Досвід ліда команди 3+'],
    generatedAt: '2026-10-22T09:05:00.000Z',
  },
  job: { id: JOB_ID, status: 'done', errorType: null },
} satisfies CvHintsResponse;

export const CV_HINTS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications/{id}/cv-hints',
    tags: ['applications'],
    summary: 'Read the CV tailoring hints of an Application',
    description:
      'The latest cv_hints ai_jobs row for the linked CV version created at or after the current Match Score, whatever its status, and its hints once it is done. A hint names a partially covered requirement, a line quoted from the CV profile, how to reword or move it, and expectedScoreImpact, the points that requirement loses now. gaps lists the missing requirements wording cannot close. Both are null without a Match Score, before the first request for it, or when the only hints predate the current score. Read only.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The latest hints and their job, or null',
        content: jsonContent(cvHintsResponseSchema, CV_HINTS),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
  {
    method: 'post',
    path: '/applications/{id}/cv-hints',
    tags: ['applications'],
    summary: 'Generate CV tailoring hints',
    description: `Builds the input from the position, the Match Score with every weighed requirement, its coverage and lost points, and the skills profile of the linked CV version (skills with evidence, position titles and dates without employers, domains, leadership), then in one transaction stores a queued cv_hints AI job and the application.cv_hints_requested event; the worker calls the model later. The model may suggest at most ${String(CV_HINTS_LIMITS.hintsMax)} hints; a hint whose evidence is not a line of the CV profile is dropped. While a cv_hints job of the Application is queued or processing it answers that job and stores nothing. The same input again is served from the AI result cache. Answers 409 when the Application has no Match Score or its CV version has no skills profile. Counts against the hourly AI limit.`,
    request: { params: applicationIdParams, headers: idempotencyHeaders },
    responses: {
      202: {
        description: 'The AI job to follow: the new one, or the one that is still running',
        content: jsonContent(captureRetryResponseSchema, { jobId: JOB_ID }),
      },
      ...errorResponses([401, 403, 404, 409, 422], 'ai'),
    },
  },
];
