import { describe, expect, it } from 'vitest';

import { fieldOfPath, previewOf } from './import-rows';

const NOW = new Date('2026-11-14T10:00:00.000Z');

const SHEET = {
  fileName: 'tracker.csv',
  header: ['Компанія', 'Посада', 'Дата відгуку', 'Етап', 'Зарплата'],
  rows: [
    ['Vela', 'Frontend', '2026-10-01', 'скринінг', '1500-2500 USD'],
    ['', 'QA', '2026-10-02', '', ''],
    ['Acme', 'Backend', '2027-01-01', 'співбесіда мрії', 'багато'],
    ...Array.from({ length: 12 }, (_, index) => [
      `Co ${String(index)}`,
      'Dev',
      '2026-10-03',
      '',
      '',
    ]),
  ],
};

const MAPPING = { company: 0, position: 1, appliedAt: 2, stage: 3, salary: 4 };

describe('previewOf', () => {
  it('checks only the first 10 rows, numbers them by their sheet line and names each broken field', () => {
    const preview = previewOf({
      sheet: SHEET,
      mapping: MAPPING,
      timeZone: 'Europe/Kyiv',
      now: NOW,
    });

    expect(preview).toHaveLength(10);
    expect(preview.slice(0, 3).map(({ line, issues }) => ({ line, issues }))).toEqual([
      { line: 2, issues: [] },
      { line: 3, issues: ['company'] },
      { line: 4, issues: ['appliedAt', 'stage', 'salary'] },
    ]);
    expect(preview[0]?.cells).toEqual({
      company: 'Vela',
      position: 'Frontend',
      appliedAt: '2026-10-01',
      stage: 'скринінг',
      salary: '1500-2500 USD',
    });
  });

  it('an unmapped required field marks every previewed row', () => {
    const preview = previewOf({
      sheet: SHEET,
      mapping: { company: 0, position: 1 },
      timeZone: 'Europe/Kyiv',
      now: NOW,
    });

    expect(preview[0]?.issues).toEqual(['appliedAt']);
  });
});

describe('fieldOfPath', () => {
  it.each([
    ['company', 'company'],
    ['salaryMin', 'salary'],
    ['salaryMax', 'salary'],
    ['currency', 'salary'],
    ['stageHistory.2.toStage', 'stageHistory'],
    ['', null],
    ['resumeVersionId', null],
  ])('reads %s as the %s column', (path, field) => {
    expect(fieldOfPath(path)).toBe(field);
  });
});
