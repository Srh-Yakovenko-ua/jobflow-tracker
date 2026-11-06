import { describe, expect, it } from 'vitest';

import { boardFiltersOf, chipsOf } from './board-filters';

const EVERY_FILTER = {
  source: 'djinni',
  stage: 'final',
  hasScore: 'true',
  silence: 'silent',
  salaryFrom: '3000',
  q: 'kafka',
};

describe('boardFiltersOf', () => {
  it('reads every board filter back from the URL of a reload', () => {
    expect(boardFiltersOf(EVERY_FILTER)).toEqual({
      source: ['djinni'],
      stage: ['final'],
      hasScore: true,
      silence: ['silent'],
      salaryFrom: 3000,
      q: 'kafka',
    });
  });

  it('drops a hand-edited value it cannot read and keeps the rest', () => {
    expect(
      boardFiltersOf({
        stage: 'bogus',
        salaryFrom: 'abc',
        hasScore: 'yes',
        source: ['djinni', 'dou'],
        silence: '',
        q: 'kafka',
        expand: 'rejected',
      }),
    ).toEqual({ q: 'kafka' });
  });

  it('reads comma lists of sources and stages', () => {
    expect(boardFiltersOf({ source: 'djinni,dou', stage: 'screening,final' })).toEqual({
      source: ['djinni', 'dou'],
      stage: ['screening', 'final'],
    });
  });
});

describe('chipsOf', () => {
  it('names one chip per source, per stage, then Match Score, silence and salary', () => {
    expect(
      chipsOf({ ...boardFiltersOf(EVERY_FILTER), source: ['djinni', 'dou'] }).map(
        (chip) => chip.label,
      ),
    ).toEqual([
      'джерело: Djinni',
      'джерело: DOU',
      'етап: фінал',
      'з Match Score',
      'лише в тиші',
      'зарплата від 3 000',
    ]);
  });

  it('a board without Match Score is named as such', () => {
    expect(chipsOf({ hasScore: false }).map((chip) => chip.label)).toEqual(['без Match Score']);
  });

  it('removing a chip takes out only its own value', () => {
    expect(
      chipsOf({ source: ['djinni', 'dou'], stage: ['final'], salaryFrom: 3000 }).map(
        (chip) => chip.removal,
      ),
    ).toStrictEqual([
      { source: ['dou'] },
      { source: ['djinni'] },
      { stage: undefined },
      { salaryFrom: undefined },
    ]);
  });

  it('no filter gives no chip, a search text alone included', () => {
    expect(chipsOf({ q: 'kafka' })).toEqual([]);
  });
});
