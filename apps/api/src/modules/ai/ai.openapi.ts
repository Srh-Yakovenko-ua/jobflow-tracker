import type { RouteConfig } from '@asteasolutions/zod-to-openapi';

import { errorResponses } from '../../openapi/route.js';

export const AI_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'delete',
    path: '/ai-results',
    tags: ['ai'],
    summary: 'Delete every AI result of the signed-in user',
    description:
      'In one transaction deletes the ai_results rows of the user and clears matchScore and aiParsed on their Applications and the AI profile of their resume versions. AI jobs stay, with aiResultId null. The timeline keeps its history.',
    responses: {
      204: { description: 'The AI results are deleted' },
      ...errorResponses([401, 403]),
    },
  },
];
