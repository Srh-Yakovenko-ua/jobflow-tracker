import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { appTestingModule, startTestApp } from '../test/app.js';
import { overrideBullConfig, testQueuePrefix } from '../test/bull-config.js';

vi.hoisted(() => {
  vi.stubEnv('NODE_ENV', 'development');
});

describe('Bull Board in development', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startTestApp(overrideBullConfig(appTestingModule(), { prefix: testQueuePrefix() }));
  });

  afterAll(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('serves the board page on /admin/queues', async () => {
    const response = await request(app.getHttpServer()).get('/admin/queues');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
  });

  it('lists the five queues read-only', async () => {
    const response = await request(app.getHttpServer()).get('/admin/queues/api/queues');

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
