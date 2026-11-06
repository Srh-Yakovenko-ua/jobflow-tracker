import type { CalendarQuery } from '@jobflow/shared';

export type VisibleRange = Readonly<{ start: Date; end: Date }>;

export function rangeOf({ start, end }: VisibleRange): CalendarQuery {
  return { from: start.toISOString(), to: end.toISOString() };
}
