import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  IMPORT_LIMITS,
  type ImportApplicationsInput,
  importApplicationsInputSchema,
  type ImportApplicationsResponse,
  importApplicationsResponseSchema,
} from '@jobflow/shared';

import { errorResponses, idempotencyHeaders, jsonContent } from '../../openapi/route.js';

const IMPORT_REQUEST = {
  rows: [
    {
      company: 'Vela',
      position: 'Frontend Engineer',
      source: 'djinni',
      appliedAt: '2026-10-01T09:00:00.000Z',
      salaryMin: 1500,
      salaryMax: 2500,
      currency: 'USD',
      url: 'https://djinni.co/jobs/42',
      stageHistory: [
        { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
        { toStage: 'screening', reasonCode: null, occurredAt: '2026-10-03T09:00:00.000Z' },
      ],
    },
    { position: 'QA', appliedAt: '2026-10-02T09:00:00.000Z', stage: 'interview' },
  ],
} satisfies ImportApplicationsInput;

const IMPORT_RESULT = {
  imported: 1,
  errors: [
    { row: 1, path: 'company', message: 'Invalid input: expected string, received undefined' },
    { row: 1, path: 'stage', message: 'Invalid option: expected one of "applied"|"screening"' },
  ],
} satisfies ImportApplicationsResponse;

export const APPLICATION_IMPORT_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/applications/import',
    tags: ['applications'],
    summary: 'Import Applications from a spreadsheet',
    description: `Takes 1 to ${String(IMPORT_LIMITS.rowsMax)} rows already mapped from the CSV columns and checks each one on its own: a row that fails is reported by its 0-based index and the path of the field, the valid rows go into the active search in one transaction (409 without one), each with one application.created event and no stage_changed events. A row with stageHistory replays it exactly and the history decides the stage; the stage machine checks every move, and ghosted revives only to the stage before it. A row without history gets applied at appliedAt plus the shortest allowed path to its stage at the same time: final and offer go through screening, rejected gets the reason unspecified.`,
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: 'The mapped rows.',
        content: jsonContent(importApplicationsInputSchema, IMPORT_REQUEST),
      },
    },
    responses: {
      200: {
        description: 'How many rows were imported, and the errors of the others',
        content: jsonContent(importApplicationsResponseSchema, IMPORT_RESULT),
      },
      ...errorResponses([400, 401, 403, 409, 422]),
    },
  },
];
