import type { Provider } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import { beforeAll, beforeEach, expect } from 'vitest';

import {
  type DomainEvent,
  DomainEventRouter,
  type EventDelivery,
} from '../outbox/domain-event-router.js';
import { memoryLog } from './memory-log.js';
import { compileProcessorModule } from './processor.js';
import { MOVE_EVENT_ID } from './service-fixtures.js';

export type SubscribedRouter = {
  readonly log: ReturnType<typeof memoryLog>;
  route: (type: string, payload: unknown) => Promise<number>;
  routeFinal: (type: string, payload: unknown) => Promise<number>;
};

export class RecordingEventQueue<Payload> {
  readonly enqueued: [Payload, EventDelivery][] = [];

  enqueue(payload: Payload, delivery: EventDelivery): Promise<void> {
    this.enqueued.push([payload, delivery]);
    return Promise.resolve();
  }
}

export type RefusedEvent = { type: string; payload: unknown; message: string };

export async function expectRefusedEvent(
  router: SubscribedRouter,
  { type, payload, message }: RefusedEvent,
): Promise<void> {
  await expect(router.route(type, payload)).rejects.toBeInstanceOf(UnrecoverableError);
  expect(router.log.parsed()).toEqual([
    expect.objectContaining({ level: 50, msg: message, eventId: MOVE_EVENT_ID }),
  ]);
}

export function useSubscribedRouter(providers: Provider[]): SubscribedRouter {
  const log = memoryLog();
  let events: DomainEventRouter | undefined;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [DomainEventRouter, ...providers]);
    await moduleRef.init();
    events = moduleRef.get(DomainEventRouter);
  });

  beforeEach(() => {
    log.lines.length = 0;
  });

  const routeAttempt = (event: Omit<DomainEvent, 'id'>) => {
    if (events === undefined) {
      throw new Error('useSubscribedRouter is routed before its beforeAll ran');
    }
    return events.route({ id: MOVE_EVENT_ID, ...event });
  };

  return {
    log,
    route: (type, payload) => routeAttempt({ type, payload }),
    routeFinal: (type, payload) => routeAttempt({ type, payload, finalAttempt: true }),
  };
}
