import { describe, expect, it } from 'vitest';

import { buildResumeVersion, resumeVersionIdOf } from '@/test/resume-fixtures';

import { applicationFiltersOf, chipsOf } from './application-filters';

const V2 = buildResumeVersion({ id: resumeVersionIdOf(2), number: 2 });

const EVERY_FILTER = {
  source: 'djinni',
  stage: 'final',
  hasScore: 'true',
  silence: 'silent',
  salaryFrom: '3000',
  q: 'kafka',
};

describe('applicationFiltersOf', () => {
  it('reads every filter back from the URL of a reload', () => {
    expect(applicationFiltersOf(EVERY_FILTER)).toEqual({
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
      applicationFiltersOf({
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

  it('drops a resume version id that is not a UUID and keeps a valid one', () => {
    expect(applicationFiltersOf({ resumeVersion: 'v2', source: 'dou' })).toEqual({
      source: ['dou'],
    });
    expect(applicationFiltersOf({ resumeVersion: V2.id })).toEqual({ resumeVersion: [V2.id] });
  });

  it('reads comma lists of sources and stages', () => {
    expect(applicationFiltersOf({ source: 'djinni,dou', stage: 'screening,final' })).toEqual({
      source: ['djinni', 'dou'],
      stage: ['screening', 'final'],
    });
  });
});

describe('chipsOf', () => {
  it('names one chip per source, per stage, then Match Score, silence and salary', () => {
    expect(
      chipsOf({ ...applicationFiltersOf(EVERY_FILTER), source: ['djinni', 'dou'] }).map(
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

  it('a filter for applications without Match Score is named as such', () => {
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

  it('names a picked resume version by its number and title, right after the sources', () => {
    expect(
      chipsOf({ source: ['dou'], resumeVersion: [V2.id], stage: ['final'] }, [V2]).map((chip) => [
        chip.id,
        chip.label,
      ]),
    ).toEqual([
      ['джерело: DOU', 'джерело: DOU'],
      [V2.id, 'CV v2 · акцент на продукті'],
      ['етап: фінал', 'етап: фінал'],
    ]);
  });

  it('a version id missing from the list gets its own chip with a generic name', () => {
    const unknown = resumeVersionIdOf(9);

    expect(chipsOf({ resumeVersion: [unknown, V2.id] })).toStrictEqual([
      { id: unknown, label: 'невідома версія CV', removal: { resumeVersion: [V2.id] } },
      { id: V2.id, label: 'невідома версія CV', removal: { resumeVersion: [unknown] } },
    ]);
  });

  it('no filter gives no chip, a search text alone included', () => {
    expect(chipsOf({ q: 'kafka' })).toEqual([]);
  });
});
