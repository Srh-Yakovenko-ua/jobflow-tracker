import { randomUUID } from 'node:crypto';

import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { QUEUES } from '../../queues/queues.js';
import { appTestingModule, startTestApp } from '../../test/app.js';
import { authAs } from '../../test/auth.js';
import { dropTestQueues, overrideBullConfig, testQueuePrefix } from '../../test/bull-config.js';
import { memoryLog, withLogSink } from '../../test/memory-log.js';
import { compileWorker, workerTestingModule } from '../../test/worker.js';

const log = memoryLog();

function processedLine() {
  return log.parsed().find((line) => line.msg === 'ping processed');
}

async function startWorker(prefix: string): Promise<INestApplicationContext> {
  const worker = await compileWorker(workerTestingModule(log.sink, { prefix }));
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
    await dropTestQueues(app);
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

  it('schedules the outbox relay every 500 ms and the cleanup every day once the worker starts', async () => {
    const maintenance = worker.get<Queue>(getQueueToken(QUEUES.maintenance.name));

    const schedulers = await maintenance.getJobSchedulers();

    expect(
      schedulers
        .map(({ key, name, every }) => ({ key, name, every }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    ).toEqual([
      { key: 'cleanup', name: 'maintenance.cleanup', every: 86_400_000 },
      { key: 'outbox-relay', name: 'outbox.relay', every: 500 },
    ]);
  });
});
