export type RoutedHandler<Event> = (event: Event) => Promise<void>;

export class HandlerRouter<Key, Event> {
  private readonly handlers = new Map<Key, RoutedHandler<Event>[]>();

  subscribe(key: Key, handler: RoutedHandler<Event>): void {
    this.handlers.set(key, [...(this.handlers.get(key) ?? []), handler]);
  }

  protected async deliver(key: Key, event: Event): Promise<number> {
    const handlers = this.handlers.get(key) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
    return handlers.length;
  }
}
