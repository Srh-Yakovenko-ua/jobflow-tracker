import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../common/app-error.js';
import type { Env } from '../../config/env.js';
import { StubQueue } from '../../test/stub-queues.js';
import { MaintenanceService } from './maintenance.service.js';

async function serviceIn(nodeEnv: Env['NODE_ENV']) {
  const queue = new StubQueue('maintenance');
  const moduleRef = await Test.createTestingModule({
    providers: [
      MaintenanceService,
      { provide: getQueueToken('maintenance'), useValue: queue },
      { provide: ConfigService, useValue: new ConfigService({ NODE_ENV: nodeEnv }) },
    ],
  }).compile();
  return { queue, service: moduleRef.get(MaintenanceService) };
}

describe('MaintenanceService.enqueuePing', () => {
  it('adds a ping job carrying the requestId and holdMs to the maintenance queue', async () => {
    const { queue, service } = await serviceIn('development');

    const accepted = await service.enqueuePing({ requestId: 'req-1', holdMs: 1500 });

    expect(accepted).toEqual({ jobId: 'maintenance-1' });
    expect(queue.jobs).toEqual([
      { id: 'maintenance-1', name: 'ping', data: { requestId: 'req-1', holdMs: 1500 } },
    ]);
  });

  it('answers 404 in production and enqueues nothing', async () => {
    const { queue, service } = await serviceIn('production');

    const failure = service.enqueuePing({ requestId: 'req-2', holdMs: 0 });

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({ body: { status: 404, type: 'not_found' } });
    expect(queue.jobs).toEqual([]);
  });
});
