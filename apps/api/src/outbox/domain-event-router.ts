import { Injectable } from '@nestjs/common';

export type DomainEvent = { id: string; type: string; payload: unknown };

export type DomainEventHandler = (event: DomainEvent) => Promise<void>;

@Injectable()
export class DomainEventRouter {
  private readonly handlers = new Map<string, DomainEventHandler[]>();

  subscribe(type: string, handler: DomainEventHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  async route(event: DomainEvent): Promise<number> {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
    return handlers.length;
  }
}
