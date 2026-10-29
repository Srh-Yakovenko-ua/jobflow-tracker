import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type ApplicationTimelineResponse,
  applicationTimelineResponseSchema,
} from '@jobflow/shared';

import { applicationIdParams, errorResponses, jsonContent } from '../../openapi/route.js';

const TIMELINE = {
  items: [
    {
      id: '0199f1d4-0c21-7e10-9a2b-3c4d5e6f7a8b',
      type: 'stage_changed',
      occurredAt: '2026-10-27T15:40:00.000Z',
      title: "техінтерв'ю → відмова",
      meta: {
        fromStage: 'tech_interview',
        toStage: 'rejected',
        reasonCode: 'skills_gap',
        comment: 'Шукають сильнішого в Kafka',
        daysInPreviousStage: 5,
      },
      actor: 'user',
    },
    {
      id: '0199f1d2-7a20-7c31-8d4e-5f6a7b8c9d0e',
      type: 'ai_parsed',
      occurredAt: '2026-10-21T08:15:04.000Z',
      title: 'AI розібрав опис за 4 секунди',
      meta: { durationSec: 4 },
      actor: 'system',
    },
  ],
} satisfies ApplicationTimelineResponse;

export const TIMELINE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications/{id}/timeline',
    tags: ['applications'],
    summary: 'Read the timeline of an Application',
    description:
      'Stage moves, system events and notes in one list, newest first. An undone move and its compensation are left out. Read only.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The timeline of the Application',
        content: jsonContent(applicationTimelineResponseSchema, TIMELINE),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
];
