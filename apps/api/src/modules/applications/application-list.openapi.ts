import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  applicationBoardQuerySchema,
  applicationBoardResponseSchema,
  type ApplicationCard,
  applicationListResponseSchema,
  rejectionReasonsSummaryQuerySchema,
  rejectionReasonsSummarySchema,
} from '@jobflow/shared';

import { errorResponses, jsonContent } from '../../openapi/route.js';
import {
  applicationCursorSchema,
  applicationListRequestSchema,
  encodeApplicationCursor,
} from './application-cursor.js';

const CARD = {
  id: '0199f1a7-3c4d-7e5f-8a6b-9c0d1e2f3a4b',
  company: 'Смерека Софт',
  position: 'Backend developer',
  source: 'linkedin',
  salaryMin: null,
  salaryMax: 5000,
  currency: 'EUR',
  matchScore: 78,
  currentStage: 'screening',
  isDraft: false,
  appliedAt: '2026-10-14T10:20:00.000Z',
  lastEventAt: '2026-10-18T14:10:00.000Z',
  daysInStage: 4,
  daysSinceLastEvent: 4,
  silenceLevel: 'warn',
  stack: ['Go', 'Kubernetes', 'gRPC'],
  stackCount: 4,
  nextScheduledEvent: { kind: 'screening_call', startsAt: '2026-10-23T13:00:00.000Z' },
  aiStatus: 'processing',
} satisfies ApplicationCard;

const TAGS = ['applications'];

const FILTERS =
  'Filters are comma lists (stage, source, silence), q searches company and position, hasScore is true or false. Without searchId only the active search is read.';

const listQuery = applicationListRequestSchema.extend({
  cursor: applicationCursorSchema.optional().meta({
    description:
      'The opaque nextCursor of the previous page, sent back unchanged; any other value answers 422 at cursor',
  }),
});

export const APPLICATION_LIST_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/applications',
    tags: TAGS,
    summary: 'List Applications as cards',
    description: `${FILTERS} Pages follow nextCursor until it is null; another user's searchId answers 404.`,
    request: { query: listQuery },
    responses: {
      200: {
        description: 'One page of cards',
        content: jsonContent(applicationListResponseSchema, {
          items: [CARD],
          nextCursor: encodeApplicationCursor({
            lastEventAt: new Date(CARD.lastEventAt),
            id: CARD.id,
          }),
        }),
      },
      ...errorResponses([401, 403, 404, 422]),
    },
  },
  {
    method: 'get',
    path: '/applications/board',
    tags: TAGS,
    summary: 'Read the kanban board of the active search',
    description: `${FILTERS} Every stage has its count; rejected, ghosted and withdrawn carry items only when named in expand.`,
    request: { query: applicationBoardQuerySchema },
    responses: {
      200: {
        description: 'The board columns by stage',
        content: jsonContent(applicationBoardResponseSchema, {
          columns: {
            applied: { count: 0, items: [] },
            screening: { count: 1, items: [CARD] },
            tech_interview: { count: 0, items: [] },
            final: { count: 0, items: [] },
            offer: { count: 0, items: [] },
            rejected: { count: 12, items: null },
            ghosted: { count: 5, items: null },
            withdrawn: { count: 1, items: null },
          },
        }),
      },
      ...errorResponses([401, 403, 422]),
    },
  },
  {
    method: 'get',
    path: '/applications/reasons-summary',
    tags: TAGS,
    summary: 'Count the rejection reasons of moves from one stage into rejected',
    description:
      'Counts the stage events from stage into rejected of the active search, leaving out undone moves and deleted applications. A missing reason counts as unspecified; reasons are sorted by count, then by the taxonomy order.',
    request: { query: rejectionReasonsSummaryQuerySchema },
    responses: {
      200: {
        description: 'The reason counts at the stage',
        content: jsonContent(rejectionReasonsSummarySchema, {
          stage: 'tech_interview',
          total: 3,
          reasons: [
            { code: 'skills_gap', count: 2 },
            { code: 'chose_other', count: 1 },
          ],
        }),
      },
      ...errorResponses([401, 403, 422]),
    },
  },
];
