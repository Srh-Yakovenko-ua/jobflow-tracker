import { OpenApiGeneratorV31, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

import { API_PREFIX } from '../common/api-prefix.middleware.js';
import { APPLICATIONS_OPENAPI_PATHS } from '../modules/applications/index.js';
import { AUTH_OPENAPI_PATHS, REFRESH_COOKIE } from '../modules/auth/index.js';
import { HEALTH_OPENAPI_PATHS } from '../modules/health/index.js';
import { MAINTENANCE_OPENAPI_PATHS } from '../modules/maintenance/index.js';

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

export const API_OPENAPI_PATHS = [
  ...HEALTH_OPENAPI_PATHS,
  ...AUTH_OPENAPI_PATHS,
  ...APPLICATIONS_OPENAPI_PATHS,
  ...MAINTENANCE_OPENAPI_PATHS,
];

const TAGS = [
  { name: 'health', description: 'Liveness and readiness probes' },
  { name: 'auth', description: 'Accounts, sessions and the signing key' },
  { name: 'applications', description: 'The Applications of the signed-in user' },
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
