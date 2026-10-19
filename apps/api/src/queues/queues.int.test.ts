import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appTestingModule, startTestApp } from '../test/app.js';
import { overrideBullConfig } from '../test/bull-config.js';
import { memoryLog, withLogSink } from '../test/memory-log.js';

const log = memoryLog();

function loggedQueueError() {
  return log.parsed().some((line) => line.msg === 'queue connection error');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the API while the queue Redis is unreachable', () => {
  it('boots, answers health and closes, logging queue errors instead of printing them', async () => {
    const stderr = vi.spyOn(process.stderr, 'write');
    const app = await startTestApp(
      overrideBullConfig(withLogSink(appTestingModule(), log.sink), {
        connection: { url: 'redis://127.0.0.1:1' },
      }),
    );

    const response = await request(app.getHttpServer()).get('/api/v1/health');
    await expect.poll(loggedQueueError).toBe(true);
    await expect(app.close()).resolves.toBeUndefined();

    expect(response.status).toBe(200);
    expect(stderr).not.toHaveBeenCalled();
  });
});
