import { Test, type TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { Logger, LoggerModule } from 'nestjs-pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loggerParams } from '../common/logger.js';
import { configModule } from '../config/app-config.js';
import type { ApplicationEvent } from '../modules/applications/index.js';
import { memoryLog } from '../test/memory-log.js';
import { recordingHandler } from '../test/outbox.js';
import { DomainEventRouter } from './domain-event-router.js';
import { DomainEventsProcessor } from './domain-events.processor.js';

const CREATED = 'application.created' satisfies ApplicationEvent['eventType'];

const STAGE_CHANGED = 'application.stage_changed' satisfies ApplicationEvent['eventType'];

const OUTBOX_ID = '019a0b7e-4c2d-7a3e-9f10-5b6c7d8e9f01';

const PAYLOAD = { userId: '019a0b7e-4c2d-7a3e-9f10-5b6c7d8e9f02', applicationId: OUTBOX_ID };

const log = memoryLog();

function domainEventJob(fields: { id?: string; name?: string } = {}) {
  return {
    id: OUTBOX_ID,
    name: CREATED,
    queueName: 'domain-events',
    data: PAYLOAD,
    attemptsMade: 0,
    ...fields,
  };
}

describe('DomainEventsProcessor', () => {
  let moduleRef: TestingModule;
  let processor: DomainEventsProcessor;
  let router: DomainEventRouter;

  beforeEach(async () => {
    log.lines.length = 0;
    moduleRef = await Test.createTestingModule({
      imports: [configModule, LoggerModule.forRoot(loggerParams(log.sink))],
      providers: [DomainEventsProcessor, DomainEventRouter],
    }).compile();
    moduleRef.useLogger(moduleRef.get(Logger));
    processor = moduleRef.get(DomainEventsProcessor);
    router = moduleRef.get(DomainEventRouter);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('hands every subscriber of the event type the outbox id, the type and the payload', async () => {
    const [first, second, other] = [recordingHandler(), recordingHandler(), recordingHandler()];
    router.subscribe(CREATED, first.handle);
    router.subscribe(CREATED, second.handle);
    router.subscribe(STAGE_CHANGED, other.handle);

    await processor.process(domainEventJob());

    const event = { id: OUTBOX_ID, type: 'application.created', payload: PAYLOAD };
    expect(first.events).toEqual([event]);
    expect(second.events).toEqual([event]);
    expect(other.events).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({
        msg: 'domain event routed',
        jobId: OUTBOX_ID,
        queue: 'domain-events',
        jobName: 'application.created',
        handlers: 2,
      }),
    ]);
  });

  it('completes an event type nobody subscribes to and reports 0 handlers', async () => {
    await expect(processor.process(domainEventJob())).resolves.toBeUndefined();

    expect(log.parsed()).toEqual([
      expect.objectContaining({ msg: 'domain event routed', handlers: 0 }),
    ]);
  });

  it('fails a job whose id is not an outbox uuid as unrecoverable, so it is not retried', async () => {
    const handler = recordingHandler();
    router.subscribe(CREATED, handler.handle);

    await expect(processor.process(domainEventJob({ id: '42' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(handler.events).toEqual([]);
    expect(log.parsed()).toEqual([
      expect.objectContaining({ level: 50, msg: 'domain event job invalid', jobId: '42' }),
    ]);
  });

  it('rejects the job when a subscriber throws, so BullMQ retries it', async () => {
    router.subscribe(CREATED, () => Promise.reject(new Error('analytics cache down')));

    const failure = await processor.process(domainEventJob()).catch((error: unknown) => error);

    expect(failure).toEqual(new Error('analytics cache down'));
    expect(failure).not.toBeInstanceOf(UnrecoverableError);
  });
});
