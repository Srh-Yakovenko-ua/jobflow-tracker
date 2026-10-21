import { randomUUID } from 'node:crypto';

import type { INestApplicationContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { appTestingModule, startTestApp } from '../../test/app.js';
import { authAs } from '../../test/auth.js';
import { overrideBullConfig, testQueuePrefix } from '../../test/bull-config.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';
import { WorkerModule } from '../../worker.module.js';

const log = memoryLog();

function processedLine() {
  return log.parsed().find((line) => line.msg === 'ping processed');
}

async function startWorker(prefix: string): Promise<INestApplicationContext> {
  const builder = withLogSink(Test.createTestingModule({ imports: [WorkerModule] }), log.sink);
  const worker = await overrideBullConfig(builder, { prefix }).compile();
  worker.useLogger(worker.get(Logger));
  return worker.init();
}

describe('a ping job added from the API', () => {
  const prefix = testQueuePrefix();
  let app: NestExpressApplication;
  let worker: INestApplicationContext;

  beforeAll(async () => {
    app = await startTestApp(
      overrideBullConfig(withLogSink(appTestingModule(), log.sink), { prefix }),
    );
    worker = await startWorker(prefix);
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
  });

  it('is processed by the worker and logged with the same requestId', async () => {
    const response = await (
      await authAs(app, { id: randomUUID() })
    )
      .post('/api/v1/dev/jobs/ping')
      .set('x-request-id', 'it-ping-1')
      .send({});

    expect(response.status).toBe(202);
    const { jobId } = response.body as { jobId: string };
    await expect
      .poll(processedLine, { timeout: 4000 })
      .toMatchObject({ requestId: 'it-ping-1', jobId, queue: 'maintenance', jobName: 'ping' });
  });
});
