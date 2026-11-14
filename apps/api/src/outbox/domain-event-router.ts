import { Injectable, Logger } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';
import type { z } from 'zod';

import { HandlerRouter, type RoutedHandler } from '../common/handler-router.js';

export type DomainEvent = { id: string; type: string; payload: unknown; finalAttempt?: boolean };

export type DomainEventHandler = RoutedHandler<DomainEvent>;

export type EventDelivery = { eventId: string; finalAttempt: boolean };

export type ParsedSubscription<Payload> = {
  type: string;
  schema: z.ZodType<Payload>;
  label: string;
  handle: (payload: Payload, delivery: EventDelivery) => Promise<unknown>;
};

@Injectable()
export class DomainEventRouter extends HandlerRouter<string, DomainEvent> {
  private readonly logger = new Logger(DomainEventRouter.name);

  route(event: DomainEvent): Promise<number> {
    return this.deliver(event.type, event);
  }

  subscribeParsed<Payload>({ type, schema, label, handle }: ParsedSubscription<Payload>): void {
    this.subscribe(type, async ({ id, payload, finalAttempt = false }) => {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        this.logger.error({ eventId: id, issues: parsed.error.issues }, `${label} invalid`);
        throw new UnrecoverableError(`${label} invalid`);
      }
      await handle(parsed.data, { eventId: id, finalAttempt });
    });
  }
}
