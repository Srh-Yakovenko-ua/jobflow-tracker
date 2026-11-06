import { calendarQuerySchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { rangeOf } from './calendar-range';

describe('rangeOf', () => {
  it('sends a Kyiv week as UTC instants ending in Z, never with an offset', () => {
    const range = rangeOf({
      start: new Date('2026-11-02T00:00:00+02:00'),
      end: new Date('2026-11-09T00:00:00+02:00'),
    });

    expect(range).toEqual({ from: '2026-11-01T22:00:00.000Z', to: '2026-11-08T22:00:00.000Z' });
  });

  it('keeps a six-week month grid inside the range the API accepts', () => {
    const range = rangeOf({
      start: new Date('2026-10-26T00:00:00+02:00'),
      end: new Date('2026-12-07T00:00:00+02:00'),
    });

    expect(calendarQuerySchema.safeParse(range).success).toBe(true);
  });
});
