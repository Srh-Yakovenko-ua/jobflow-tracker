import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { API_PREFIX } from '../common/api-prefix.middleware.js';
import { AI_OPENAPI_PATHS } from '../modules/ai/index.js';
import { APPLICATIONS_OPENAPI_PATHS } from '../modules/applications/index.js';
import { AUTH_OPENAPI_PATHS, REFRESH_COOKIE } from '../modules/auth/index.js';
import { CAPTURE_OPENAPI_PATHS } from '../modules/capture/index.js';
import { CONTACTS_OPENAPI_PATHS } from '../modules/contacts/index.js';
import { TIMELINE_OPENAPI_PATHS } from '../modules/events/index.js';
import { HEALTH_OPENAPI_PATHS } from '../modules/health/index.js';
import { MAINTENANCE_OPENAPI_PATHS } from '../modules/maintenance/index.js';
import { NOTES_OPENAPI_PATHS } from '../modules/notes/index.js';
import { RESUMES_OPENAPI_PATHS } from '../modules/resumes/index.js';
import { SCHEDULE_OPENAPI_PATHS } from '../modules/schedule/index.js';
import { SEARCHES_OPENAPI_PATHS } from '../modules/searches/index.js';
import { SETTINGS_OPENAPI_PATHS } from '../modules/settings/index.js';

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

export const API_OPENAPI_PATHS = [
  ...HEALTH_OPENAPI_PATHS,
  ...AUTH_OPENAPI_PATHS,
  ...SETTINGS_OPENAPI_PATHS,
  ...SEARCHES_OPENAPI_PATHS,
  ...APPLICATIONS_OPENAPI_PATHS,
  ...TIMELINE_OPENAPI_PATHS,
  ...NOTES_OPENAPI_PATHS,
  ...CONTACTS_OPENAPI_PATHS,
  ...SCHEDULE_OPENAPI_PATHS,
  ...RESUMES_OPENAPI_PATHS,
  ...AI_OPENAPI_PATHS,
  ...CAPTURE_OPENAPI_PATHS,
  ...MAINTENANCE_OPENAPI_PATHS,
];

const TAGS = [
  { name: 'health', description: 'Liveness and readiness probes' },
  { name: 'auth', description: 'Accounts, sessions and the signing key' },
  { name: 'settings', description: 'The preferences of the signed-in user' },
  { name: 'searches', description: 'The job searches of the signed-in user and their totals' },
  { name: 'applications', description: 'The Applications of the signed-in user' },
  { name: 'calendar', description: 'Scheduled events and follow-ups across Applications' },
  {
    name: 'resumes',
    description: 'Resume files of the signed-in user, uploaded straight to storage',
  },
  { name: 'ai', description: 'The AI results of the signed-in user' },
  { name: 'capture', description: 'Draft Applications captured from a vacancy and parsed by AI' },
  { name: 'dev', description: 'Development and test only' },
];

const DESCRIPTION =
  'Errors share one shape with a requestId. Every route is rate limited and answers 429 with Retry-After.';

export function buildOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
  registry.registerComponent('securitySchemes', 'refreshCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: REFRESH_COOKIE,
  });
  registry.registerComponent('securitySchemes', 'captureToken', {
    type: 'apiKey',
    in: 'header',
    name: 'Authorization',
    description: 'Capture <token>',
  });
  API_OPENAPI_PATHS.forEach((route) => {
    registry.registerPath(route);
  });
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'JobFlow Tracker API', version: '1.0.0', description: DESCRIPTION },
    servers: [{ url: `/${API_PREFIX}` }],
    security: [{ bearerAuth: [] }],
    tags: TAGS,
  });
}
