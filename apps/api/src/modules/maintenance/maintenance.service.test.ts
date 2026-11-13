import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../common/app-error.js';
import type { Env } from '../../config/env.js';
import { RefusingQueue, SilentQueue, StubQueue } from '../../test/stub-queues.js';
import { MaintenanceService } from './maintenance.service.js';

type ServiceSetup = { nodeEnv?: Env['NODE_ENV']; queue?: StubQueue };

async function serviceIn({
  nodeEnv = 'development',
  queue = new StubQueue('maintenance'),
}: ServiceSetup = {}) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      MaintenanceService,
      { provide: getQueueToken('maintenance'), useValue: queue },
      { provide: ConfigService, useValue: new ConfigService({ NODE_ENV: nodeEnv }) },
    ],
  }).compile();
  return { queue, service: moduleRef.get(MaintenanceService) };
}

const RUN_SILENCE_SCAN = { schedule: 'silence-scan', requestId: 'req-3' } as const;

describe('MaintenanceService.enqueuePing', () => {
  it('adds a ping job carrying the requestId and holdMs to the maintenance queue', async () => {
    const { queue, service } = await serviceIn();

    const accepted = await service.enqueuePing({ requestId: 'req-1', holdMs: 1500 });

    expect(accepted).toEqual({ jobId: 'maintenance-1' });
    expect(queue.jobs).toEqual([
      { id: 'maintenance-1', name: 'ping', data: { requestId: 'req-1', holdMs: 1500 } },
    ]);
  });

  it('answers 404 in production and enqueues nothing', async () => {
    const { queue, service } = await serviceIn({ nodeEnv: 'production' });

    const failure = service.enqueuePing({ requestId: 'req-2', holdMs: 0 });

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ body: { status: 404, type: 'not_found' } });
    expect(queue.jobs).toEqual([]);
  });
});

describe('MaintenanceService.runNow', () => {
  it("adds the schedule's job carrying the requestId to the maintenance queue", async () => {
    const { queue, service } = await serviceIn();

    await expect(service.runNow(RUN_SILENCE_SCAN)).resolves.toEqual({ jobId: 'maintenance-1' });

    expect(queue.jobs).toEqual([
      { id: 'maintenance-1', name: 'silence.scan', data: { requestId: 'req-3' } },
    ]);
  });

  it('answers 404 in production and enqueues nothing', async () => {
    const { queue, service } = await serviceIn({ nodeEnv: 'production' });

    await expect(service.runNow(RUN_SILENCE_SCAN)).rejects.toMatchObject({
      body: { status: 404, type: 'not_found' },
    });
    expect(queue.jobs).toEqual([]);
  });

  it.each([
    ['refuses the connection', new RefusingQueue('maintenance')],
    ['is open but never answers', new SilentQueue('maintenance')],
  ])('answers 503 while the queue Redis %s', async (_, queue) => {
    const { service } = await serviceIn({ queue });

    await expect(service.runNow(RUN_SILENCE_SCAN)).rejects.toMatchObject({
      body: { status: 503, detail: 'Redis is not reachable' },
    });
  });
});
