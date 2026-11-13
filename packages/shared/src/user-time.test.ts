import { describe, expect, it } from 'vitest';

import { userNow } from './user-time.js';

const KYIV = { timezone: 'Europe/Kyiv' } as const;

describe('userNow', () => {
  it.for([
    ['2026-06-01T04:00:00Z', 1, 7],
    ['2026-06-01T03:00:00Z', 1, 6],
    ['2026-12-01T05:00:00Z', 1, 7],
  ] as const)('reads %s in Europe/Kyiv as day %i, hour %i', ([instant, day, hour]) => {
    const local = userNow(KYIV, new Date(instant));

    expect({ day: local.getDate(), hour: local.getHours() }).toEqual({ day, hour });
  });
});
