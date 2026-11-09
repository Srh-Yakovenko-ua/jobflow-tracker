import { Injectable } from '@nestjs/common';

import { HandlerRouter, type RoutedHandler } from '../common/handler-router.js';

export type DomainEvent = { id: string; type: string; payload: unknown };

export type DomainEventHandler = RoutedHandler<DomainEvent>;

@Injectable()
export class DomainEventRouter extends HandlerRouter<string, DomainEvent> {
  route(event: DomainEvent): Promise<number> {
    return this.deliver(event.type, event);
  }
}
