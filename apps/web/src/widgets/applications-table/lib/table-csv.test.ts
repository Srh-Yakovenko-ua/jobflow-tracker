import type { ApplicationListItem } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FULL_CARD } from '@/entities/application';

import { DATA_COLUMN_IDS } from '../model/columns';
import { tableCsvFileOf, tableCsvOf } from './table-csv';

const KYIV = 'Europe/Kyiv';

const LATE_EVENING: ApplicationListItem = {
  ...FULL_CARD,
  company: 'Соняшник',
  position: 'Дизайнер продукту',
  currentStage: 'tech_interview',
  source: 'linkedin',
  matchScore: 91,
  salaryMin: 4000,
  salaryMax: 5200,
  currency: 'EUR',
  appliedAt: '2026-10-19T21:30:00Z',
  lastEventAt: '2026-11-04T22:15:00Z',
  daysInStage: 12,
  snippet: null,
};

const BLANK: ApplicationListItem = {
  ...LATE_EVENING,
  company: 'Kvit Software',
  position: 'Node.js Engineer',
  currentStage: 'ghosted',
  matchScore: null,
  salaryMin: null,
  salaryMax: null,
  currency: null,
  appliedAt: null,
};

describe('tableCsvOf', () => {
  it('splits the vacancy into company and position and the salary into from, to and currency, with dates as days in the user zone', () => {
    const csv = tableCsvOf({
      applications: [LATE_EVENING],
      columns: DATA_COLUMN_IDS,
      timeZone: KYIV,
    });

    expect(csv.header).toEqual([
      'Компанія',
      'Посада',
      'Етап',
      'Match Score',
      'Зарплата від',
      'Зарплата до',
      'Валюта',
      'Джерело',
      'Дата відгуку',
      'Остання подія',
      'Днів на етапі',
    ]);
    expect(csv.rows).toEqual([
      [
        'Соняшник',
        'Дизайнер продукту',
        "техінтерв'ю",
        91,
        4000,
        5200,
        'EUR',
        'LinkedIn',
        '2026-10-20',
        '2026-11-05',
        12,
      ],
    ]);
  });

  it('leaves a missing score, salary, currency and applied date empty', () => {
    const csv = tableCsvOf({ applications: [BLANK], columns: DATA_COLUMN_IDS, timeZone: KYIV });

    expect(csv.rows).toEqual([
      [
        'Kvit Software',
        'Node.js Engineer',
        'ghosted',
        '',
        '',
        '',
        '',
        'LinkedIn',
        '',
        '2026-11-05',
        12,
      ],
    ]);
  });

  it('keeps only the shown columns in their order and the rows in the order given', () => {
    const csv = tableCsvOf({
      applications: [BLANK, LATE_EVENING],
      columns: ['score', 'vacancy'],
      timeZone: 'UTC',
    });

    expect(csv).toEqual({
      header: ['Match Score', 'Компанія', 'Посада'],
      rows: [
        ['', 'Kvit Software', 'Node.js Engineer'],
        [91, 'Соняшник', 'Дизайнер продукту'],
      ],
    });
  });
});

describe('tableCsvFileOf', () => {
  it('names the file by the day in the user zone and types it as UTF-8 CSV', () => {
    const file = tableCsvFileOf({
      applications: [],
      columns: ['vacancy'],
      timeZone: KYIV,
      now: new Date('2026-11-05T22:30:00Z'),
    });

    expect(file).toEqual({
      text: '\uFEFFКомпанія;Посада\r\n',
      fileName: 'jobflow-applications-2026-11-06.csv',
      type: 'text/csv;charset=utf-8',
    });
  });
});
