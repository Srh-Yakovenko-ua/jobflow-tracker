import { Test } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { Logger, LoggerModule } from 'nestjs-pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { loggerParams } from '../../common/logger.js';
import { configModule } from '../../config/app-config.js';
import { OutboxRelayService } from '../../outbox/outbox-relay.service.js';
import { memoryLog } from '../../test/memory-log.js';
import { MaintenanceProcessor } from './maintenance.processor.js';

const log = memoryLog();

class FakeOutboxRelay {
  readonly calls: string[] = [];

  relay(): Promise<number> {
    this.calls.push('relay');
    return Promise.resolve(3);
  }

  deletePublished(): Promise<number> {
    this.calls.push('deletePublished');
    return Promise.resolve(1);
  }
}

function pingJob(data: unknown) {
  return { id: '42', name: 'ping', queueName: 'maintenance', data, attemptsMade: 0 };
}

function tickJob(name: string) {
  return { ...pingJob(undefined), name };
}

describe('MaintenanceProcessor', () => {
  const outbox = new FakeOutboxRelay();
  let processor: MaintenanceProcessor;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [configModule, LoggerModule.forRoot(loggerParams(log.sink))],
      providers: [MaintenanceProcessor, { provide: OutboxRelayService, useValue: outbox }],
    }).compile();
    moduleRef.useLogger(moduleRef.get(Logger));
    processor = moduleRef.get(MaintenanceProcessor);
    close = () => moduleRef.close();
  });

  beforeEach(() => {
    log.lines.length = 0;
    outbox.calls.length = 0;
  });

  afterAll(async () => {
    await close();
  });

  it('fails a ping without a requestId as unrecoverable, so it is not retried', async () => {
    await expect(processor.process(pingJob({ holdMs: 0 }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'ping payload invalid', jobId: '42' }),
    ]);
  });

  it('logs ping started and ping processed with the requestId, jobId, queue and job name', async () => {
    await processor.process(pingJob({ requestId: 'req-7', holdMs: 0 }));

    const fields = { requestId: 'req-7', jobId: '42', queue: 'maintenance', jobName: 'ping' };
    expect(log.parsed()).toEqual([
      expect.objectContaining({ ...fields, msg: 'ping started' }),
      expect.objectContaining({ ...fields, msg: 'ping processed' }),
    ]);
  });

  it('logs a failed job with its requestId and attemptsMade', () => {
    processor.onFailed(
      { ...pingJob({ requestId: 'req-8', holdMs: 0 }), attemptsMade: 2 },
      new Error('boom'),
    );

    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 40,
        msg: 'job failed',
        requestId: 'req-8',
        attemptsMade: 2,
        err: 'boom',
      }),
    ]);
  });

  it('runs one outbox relay pass for an outbox.relay job', async () => {
    await processor.process(tickJob('outbox.relay'));

    expect(outbox.calls).toEqual(['relay']);
  });

  it('deletes published outbox rows for a maintenance.cleanup job', async () => {
    await processor.process(tickJob('maintenance.cleanup'));

    expect(outbox.calls).toEqual(['deletePublished']);
  });

  it('fails a job with an unknown name as unrecoverable and runs nothing', async () => {
    await expect(processor.process(tickJob('outbox.replay'))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(outbox.calls).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        level: 50,
        msg: 'maintenance job unknown',
        jobName: 'outbox.replay',
      }),
    ]);
  });
});
