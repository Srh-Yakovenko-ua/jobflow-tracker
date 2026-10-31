import type { TimelineEntry } from '../modules/events/index.js';

export type ByUser<Input> = Input & { userId: string };

export class RecordedEvents<Event extends object> {
  readonly events: ByUser<Event>[] = [];

  recordEvent(userId: string, input: Event): Promise<void> {
    this.events.push({ userId, ...input });
    return Promise.resolve();
  }
}

export class TimelineRecorder extends RecordedEvents<TimelineEntry> {
  record(userId: string, entry: TimelineEntry): Promise<void> {
    return this.recordEvent(userId, entry);
  }
}
