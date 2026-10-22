import { describe, expect, it } from 'vitest';

import {
  effectiveSilenceDays,
  SILENCE_LEVELS,
  type SilenceLevel,
  silenceLevelOf,
  type SilenceWindow,
  silenceWindows,
  wholeDaysBetween,
} from './silence.js';
import { ACTIVE_STAGES, type Stage, STAGES } from './stages.js';

const SILENCE_ROWS: readonly (readonly [Stage, number, SilenceLevel])[] = [
  ['applied', 3, 'none'],
  ['applied', 4, 'warn'],
  ['applied', 6, 'warn'],
  ['applied', 7, 'silent'],
  ['screening', 9, 'silent'],
  ['tech_interview', 4, 'warn'],
  ['final', 6, 'none'],
  ['final', 7, 'warn'],
  ['final', 13, 'warn'],
  ['final', 14, 'silent'],
  ['offer', 30, 'none'],
  ['rejected', 30, 'none'],
  ['ghosted', 30, 'none'],
  ['withdrawn', 30, 'none'],
];

describe('silenceLevelOf', () => {
  it.for(SILENCE_ROWS)(
    'answers %s after %i silent days with silenceDays 7 as %s',
    ([stage, daysSinceLastEvent, expected]) => {
      expect(silenceLevelOf({ stage, silenceDays: 7, daysSinceLastEvent })).toBe(expected);
    },
  );
});

describe('effectiveSilenceDays', () => {
  it('doubles the threshold on final', () => {
    expect(effectiveSilenceDays({ silenceDays: 7 }, 'final')).toBe(14);
  });

  it('keeps the setting on an earlier stage', () => {
    expect(effectiveSilenceDays({ silenceDays: 10 }, 'screening')).toBe(10);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-22T12:00:00.000Z');
const SILENCE_DAYS_CASES = [1, 2, 7, 10];
const AGREEMENT_CASES = STAGES.flatMap((stage) =>
  SILENCE_DAYS_CASES.map((silenceDays) => ({ stage, silenceDays })),
);

type SilenceCase = { stage: Stage; silenceDays: number };
type SilenceRow = { stage: Stage; lastEventAt: Date };

const lastEventInstantsOf = ({ stage, silenceDays }: SilenceCase): Date[] => {
  const lastDay = 3 * effectiveSilenceDays({ silenceDays }, stage) + 1;
  const days = Array.from({ length: lastDay + 1 }, (_, day) => day);
  const instants = days.flatMap((day) =>
    [-1, 0, 1].map((offsetMs) => NOW.getTime() - day * DAY_MS + offsetMs),
  );
  return [...instants, NOW.getTime() + DAY_MS].map((instant) => new Date(instant));
};

const windowHolds = (window: SilenceWindow, { stage, lastEventAt }: SilenceRow): boolean =>
  window.stages.includes(stage) &&
  (window.lastEventAtOrBefore === undefined || lastEventAt <= window.lastEventAtOrBefore) &&
  (window.lastEventAfter === undefined || lastEventAt > window.lastEventAfter);

const windowLevelsOf = ({ silenceDays, ...row }: SilenceRow & { silenceDays: number }) =>
  SILENCE_LEVELS.filter((level) =>
    silenceWindows({ levels: [level], silenceDays, now: NOW }).some((window) =>
      windowHolds(window, row),
    ),
  );

describe('silenceWindows', () => {
  it.for(AGREEMENT_CASES)(
    'puts every $stage row with silenceDays $silenceDays in the windows of its silenceLevelOf level only',
    ({ stage, silenceDays }) => {
      for (const lastEventAt of lastEventInstantsOf({ stage, silenceDays })) {
        const daysSinceLastEvent = wholeDaysBetween(lastEventAt, NOW);
        const expected = silenceLevelOf({ stage, silenceDays, daysSinceLastEvent });
        expect(windowLevelsOf({ stage, silenceDays, lastEventAt })).toEqual([expected]);
      }
    },
  );

  it('places applied after exactly 7 of 7 days in silent and 3 days 23 hours in none', () => {
    const levelsAfter = (ms: number) =>
      windowLevelsOf({
        stage: 'applied',
        silenceDays: 7,
        lastEventAt: new Date(NOW.getTime() - ms),
      });
    expect(levelsAfter(7 * DAY_MS)).toEqual(['silent']);
    expect(levelsAfter(4 * DAY_MS - 1)).toEqual(['none']);
    expect(levelsAfter(4 * DAY_MS)).toEqual(['warn']);
  });

  it.for(ACTIVE_STAGES.filter((stage) => stage !== 'final'))(
    'leaves %s out of warn at every age when silenceDays is 1',
    (stage) => {
      const levels = lastEventInstantsOf({ stage, silenceDays: 1 }).flatMap((lastEventAt) =>
        windowLevelsOf({ stage, silenceDays: 1, lastEventAt }),
      );
      expect(levels).not.toContain('warn');
      expect(levels).toContain('silent');
    },
  );

  it('keeps offer, rejected, ghosted and withdrawn in none at any age', () => {
    const none = silenceWindows({ levels: ['none'], silenceDays: 7, now: NOW });
    expect(none).toContainEqual({ stages: ['offer', 'rejected', 'ghosted', 'withdrawn'] });
  });

  it('answers no window for no level', () => {
    expect(silenceWindows({ levels: [], silenceDays: 7, now: NOW })).toEqual([]);
  });
});

describe('wholeDaysBetween', () => {
  const from = new Date('2026-10-01T09:00:00.000Z');

  it('counts 3 days 23 hours as 3 whole days', () => {
    expect(wholeDaysBetween(from, new Date('2026-10-05T08:00:00.000Z'))).toBe(3);
  });

  it('counts exactly 8 days as 8', () => {
    expect(wholeDaysBetween(from, new Date('2026-10-09T09:00:00.000Z'))).toBe(8);
  });

  it('clamps an instant in the future to 0', () => {
    expect(wholeDaysBetween(from, new Date('2026-09-28T09:00:00.000Z'))).toBe(0);
  });
});
