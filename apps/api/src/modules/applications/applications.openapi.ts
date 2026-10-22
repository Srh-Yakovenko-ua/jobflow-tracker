import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  applicationIdSchema,
  applicationPatchSchema,
  type ApplicationResponse,
  applicationResponseSchema,
  createApplicationInputSchema,
  STAGE_CHANGE_HINT,
} from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, jsonContent } from '../../openapi/route.js';
import { APPLICATION_LIST_OPENAPI_PATHS } from './application-list.openapi.js';

const NEW_APPLICATION = {
  company: 'Кавун Лабс',
  position: 'Node.js engineer',
  url: 'https://jobs.example.com/kavun-labs/node-engineer',
  source: 'djinni',
  salaryMin: 3000,
  salaryMax: 4500,
  currency: 'USD',
  stack: ['TypeScript', 'NestJS', 'PostgreSQL'],
  location: 'Львів',
  workMode: 'hybrid',
} satisfies z.input<typeof createApplicationInputSchema>;

const APPLICATION = {
  ...NEW_APPLICATION,
  id: '0199f0c4-6e3f-7c42-9d50-7b8c9d0e1f2a',
  searchId: '0199f0b2-1a2b-7c3d-8e4f-5a6b7c8d9e0f',
  currentStage: 'applied',
  isDraft: false,
  resumeVersionId: '0199f0b3-2b3c-7d4e-9f50-6b7c8d9e0f1a',
  matchScore: null,
  aiParsed: null,
  rawText: null,
  appliedAt: '2026-10-20T08:30:00.000Z',
  lastEventAt: '2026-10-20T08:30:00.000Z',
  createdAt: '2026-10-20T08:30:00.000Z',
  updatedAt: '2026-10-20T08:30:00.000Z',
  daysInStage: 2,
  daysSinceLastEvent: 2,
  silenceLevel: 'none',
} satisfies ApplicationResponse;

const APPLICATION_PATCH = {
  position: 'Senior Node.js engineer',
  salaryMin: 4000,
  salaryMax: 5500,
} satisfies z.input<typeof applicationPatchSchema>;

const APPLICATION_PATH = '/applications/{id}';

const TAGS = ['applications'];

const idParams = z.object({ id: applicationIdSchema.meta({ example: APPLICATION.id }) });

const applicationReply = {
  description: 'The Application',
  content: jsonContent(applicationResponseSchema, APPLICATION),
};

const ownedErrors = errorResponses([401, 403, 404, 422]);

export const APPLICATIONS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/applications',
    tags: TAGS,
    summary: 'Create an Application',
    description: 'Adds an Application to the active search at stage applied; 409 without one.',
    request: {
      body: { required: true, content: jsonContent(createApplicationInputSchema, NEW_APPLICATION) },
    },
    responses: {
      201: { ...applicationReply, description: 'The created Application' },
      ...errorResponses([400, 401, 403, 409, 422]),
    },
  },
  {
    method: 'get',
    path: APPLICATION_PATH,
    tags: TAGS,
    summary: 'Read an Application',
    request: { params: idParams },
    responses: { 200: applicationReply, ...ownedErrors },
  },
  {
    method: 'patch',
    path: APPLICATION_PATH,
    tags: TAGS,
    summary: 'Change the fields of an Application',
    request: {
      params: idParams,
      body: {
        required: true,
        description: `Send at least one field; salaryMin and salaryMax travel together. currentStage is refused: ${STAGE_CHANGE_HINT}.`,
        content: jsonContent(applicationPatchSchema, APPLICATION_PATCH),
      },
    },
    responses: {
      200: {
        description: 'The changed Application',
        content: jsonContent(applicationResponseSchema, {
          ...APPLICATION,
          ...APPLICATION_PATCH,
          updatedAt: '2026-10-22T09:15:00.000Z',
        }),
      },
      ...errorResponses([400, 401, 403, 404, 422]),
    },
  },
  {
    method: 'delete',
    path: APPLICATION_PATH,
    tags: TAGS,
    summary: 'Delete an Application',
    request: { params: idParams },
    responses: { 204: { description: 'The Application is deleted' }, ...ownedErrors },
  },
  ...APPLICATION_LIST_OPENAPI_PATHS,
];
