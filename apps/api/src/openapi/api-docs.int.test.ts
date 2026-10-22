import { errorResponseSchema } from '@jobflow/shared';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { useTestApp } from '../test/app.js';
import { cspDirectives, devToolsTestingModule } from '../test/dev-tools.js';
import { documentedOperations, operationKey, registeredOperations } from '../test/openapi.js';

vi.hoisted(() => {
  vi.stubEnv('NODE_ENV', 'development');
});

const API_DOCS_MISSES = [
  ['post', '/api/docs/openapi.json'],
  ['get', '/api/docs/openapi.json/x'],
  ['post', '/api/docs/'],
  ['get', '/api/docs/nope.js'],
] as const;

describe('the API docs in development', () => {
  const testApp = useTestApp(devToolsTestingModule);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('redirects GET /api/docs to /api/docs/', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/docs');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/api/docs/');
  });

  it('serves the Swagger UI page on /api/docs/ with its scripts, styles and fonts from its own origin', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(Object.fromEntries(cspDirectives(response))).toMatchObject({
      'font-src': "'self'",
      'script-src': "'self'",
      'style-src': "'self' 'unsafe-inline'",
    });
  });

  it('serves the Swagger UI stylesheet', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/docs/swagger-ui.css');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/css/);
  });

  it('serves an OpenAPI 3.1 document with exactly the routes the app registers', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/api/docs/openapi.json');

    const documented = documentedOperations(response.body).map(operationKey);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ openapi: '3.1.0' });
    expect(new Set(documented)).toEqual(new Set(registeredOperations(testApp.app)));
  });

  it.each(API_DOCS_MISSES)('answers %s %s with 404 in the error format', async (method, path) => {
    const response = await request(testApp.app.getHttpServer())[method](path);

    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).type).toBe('not_found');
  });
});
