import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { memoryLog } from '../test/memory-log.js';
import { compileProcessorModule } from '../test/processor.js';
import { MetricsRegistry } from './metrics-registry.js';
import { WorkerMetricsServer } from './worker-metrics-server.js';

const log = memoryLog();

describe('WorkerMetricsServer', () => {
  let moduleRef: TestingModule;
  let metricsServer: WorkerMetricsServer;

  const call = (path: string, init: RequestInit = {}) => {
    const address = metricsServer.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('the worker metrics server is not listening on a TCP port');
    }
    return fetch(`http://127.0.0.1:${String(address.port)}${path}`, init);
  };

  beforeAll(async () => {
    moduleRef = await compileProcessorModule(log.sink, [WorkerMetricsServer, MetricsRegistry]);
    await moduleRef.init();
    metricsServer = moduleRef.get(WorkerMetricsServer);
  });

  afterAll(() => moduleRef.close());

  it('answers GET /metrics with the registry in the Prometheus text format', async () => {
    const response = await call('/metrics');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(await response.text()).toContain('# TYPE process_cpu_user_seconds_total counter');
  });

  it.each([
    { request: 'GET of another path', path: '/health', init: {} },
    { request: 'POST /metrics', path: '/metrics', init: { method: 'POST' } },
  ])('answers 404 to a $request', async ({ path, init }) => {
    const response = await call(path, init);

    expect(response.status).toBe(404);
  });

  it('stops listening when the module is destroyed', async () => {
    const closing = await compileProcessorModule(log.sink, [WorkerMetricsServer, MetricsRegistry]);
    await closing.init();
    const { server } = closing.get(WorkerMetricsServer);
    const listeningAfterBoot = server.listening;

    await closing.close();

    expect([listeningAfterBoot, server.listening]).toEqual([true, false]);
  });
});
