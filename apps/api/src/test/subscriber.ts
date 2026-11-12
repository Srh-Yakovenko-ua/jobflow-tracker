import type { Provider } from '@nestjs/common';
import { beforeAll, beforeEach } from 'vitest';

import { DomainEventRouter } from '../outbox/domain-event-router.js';
import { memoryLog } from './memory-log.js';
import { compileProcessorModule } from './processor.js';
import { MOVE_EVENT_ID } from './service-fixtures.js';

export type SubscribedRouter = {
  readonly log: ReturnType<typeof memoryLog>;
  route: (type: string, payload: unknown) => Promise<number>;
};

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

  return {
    log,
    route: (type, payload) => {
      if (events === undefined) {
        throw new Error('useSubscribedRouter is routed before its beforeAll ran');
      }
      return events.route({ id: MOVE_EVENT_ID, type, payload });
    },
  };
}
