import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { useTestApp } from '../test/app.js';
import { cspDirectives, devToolsTestingModule } from '../test/dev-tools.js';

vi.hoisted(() => {
  vi.stubEnv('NODE_ENV', 'development');
});

describe('Bull Board in development', () => {
  const testApp = useTestApp(devToolsTestingModule);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('serves the board page on /admin/queues', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/admin/queues');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
  });

  it('keeps the board fonts and styles on its own origin', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/admin/queues');

    const directives = cspDirectives(response);
    expect(directives.get('font-src')).toBe("'self'");
    expect(directives.get('style-src')).toBe("'self' 'unsafe-inline'");
    expect(directives.get('script-src')).toBe("'self'");
    expect(directives.has('upgrade-insecure-requests')).toBe(false);
  });

  it('lists the five queues read-only', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/admin/queues/api/queues');

    const { queues } = response.body as { queues: { name: string; readOnlyMode: boolean }[] };
    expect(response.status).toBe(200);
    expect(queues.map(({ name, readOnlyMode }) => ({ name, readOnlyMode }))).toEqual([
      { name: 'ai', readOnlyMode: true },
      { name: 'notifications', readOnlyMode: true },
      { name: 'push', readOnlyMode: true },
      { name: 'domain-events', readOnlyMode: true },
      { name: 'maintenance', readOnlyMode: true },
    ]);
  });
});
