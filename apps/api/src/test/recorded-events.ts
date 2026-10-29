export type ByUser<Input> = Input & { userId: string };

export class RecordedEvents<Event extends object> {
  readonly events: ByUser<Event>[] = [];

  recordEvent(userId: string, input: Event): Promise<void> {
    this.events.push({ userId, ...input });
    return Promise.resolve();
  }
}
