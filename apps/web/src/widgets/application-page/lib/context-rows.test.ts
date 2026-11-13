import type { ApplicationResponse } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { applicationResponseOf } from '@/test/board-fixtures';
import { DESIGN_NORMS, UNKNOWN_NORMS } from '@/test/norms-fixtures';

import { type ContextNorms, contextNormsOf, contextRowsOf, NO_NORMS } from './context-rows';

const NOW = new Date('2026-11-15T09:00:00.000Z');

const DJINNI_APPLICATION = applicationResponseOf({
  source: 'djinni',
  currentStage: 'tech_interview',
  daysInStage: 13,
  appliedAt: '2026-10-20T09:00:00Z',
  createdAt: '2026-10-12T09:00:00Z',
});

const KNOWN_NORMS: ContextNorms = { medianDaysToOffer: 41, stageNormDays: 17 };

function rowsOf(application: ApplicationResponse, norms: ContextNorms = KNOWN_NORMS) {
  return contextRowsOf({ application, now: NOW, timeZone: 'Europe/Kyiv', norms }).map(
    ({ label, value, hint }) => [label, value, hint],
  );
}

describe('contextRowsOf', () => {
  it('reads the source, the days in the funnel, the median to offer and the stage against its norm', () => {
    expect(rowsOf(DJINNI_APPLICATION)).toEqual([
      ['джерело', 'Djinni', null],
      ['у воронці', '26 днів', null],
      ['твоя медіана до офера', '41 день', null],
      ['на етапі', '13 днів · норма 17', null],
    ]);
  });

  it('counts the funnel from the day the application was created when it has no applied date', () => {
    const captured = { ...DJINNI_APPLICATION, appliedAt: null };

    expect(rowsOf(captured)[1]).toEqual(['у воронці', '34 дні', null]);
  });

  it('shows мало даних instead of a number while the norms are unknown', () => {
    expect(rowsOf(DJINNI_APPLICATION, NO_NORMS).slice(2)).toEqual([
      ['твоя медіана до офера', null, 'мало даних'],
      ['на етапі', '13 днів', 'мало даних'],
    ]);
  });

  it('contextNormsOf gives the median to offer and the norm of the active stage from the fetched norms', () => {
    expect(contextNormsOf({ norms: DESIGN_NORMS, stage: 'final' })).toEqual({
      medianDaysToOffer: 37,
      stageNormDays: 17,
    });
  });

  it.each(['offer', 'rejected', 'ghosted'] as const)(
    'contextNormsOf gives a %s application the median to offer and no stage norm',
    (stage) => {
      expect(contextNormsOf({ norms: DESIGN_NORMS, stage })).toEqual({
        medianDaysToOffer: 37,
        stageNormDays: null,
      });
    },
  );

  it('contextNormsOf falls back to NO_NORMS while the norms are pending or failed', () => {
    expect(contextNormsOf({ norms: undefined, stage: 'final' })).toBe(NO_NORMS);
  });

  it('contextNormsOf keeps a stage norm the service cut below 5 data points as unknown', () => {
    expect(contextNormsOf({ norms: UNKNOWN_NORMS, stage: 'screening' })).toEqual(NO_NORMS);
  });

  it.each(['rejected', 'withdrawn'] as const)(
    'a %s application has no row for days on the stage',
    (currentStage) => {
      const rows = rowsOf({ ...DJINNI_APPLICATION, currentStage });

      expect(rows.map(([label]) => label)).toEqual([
        'джерело',
        'у воронці',
        'твоя медіана до офера',
      ]);
    },
  );
});
