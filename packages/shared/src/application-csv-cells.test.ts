import { describe, expect, it } from 'vitest';

import {
  importedInstantOf,
  salaryOf,
  salaryText,
  stageHistoryOf,
  stageHistoryText,
} from './application-csv-cells.js';
import type { ImportedStageEvent } from './schemas/application-import.js';

const KYIV = 'Europe/Kyiv';

describe('salaryText and salaryOf', () => {
  it.each([
    { salary: { salaryMin: 1500, salaryMax: 2500, currency: 'USD' }, text: '1500-2500 USD' },
    { salary: { salaryMin: 1500, salaryMax: null, currency: null }, text: '1500-' },
    { salary: { salaryMin: null, salaryMax: 2500, currency: 'EUR' }, text: '-2500 EUR' },
    { salary: { salaryMin: null, salaryMax: null, currency: 'UAH' }, text: 'UAH' },
    { salary: { salaryMin: null, salaryMax: null, currency: null }, text: '' },
  ])('writes $text and reads it back unchanged', ({ salary, text }) => {
    expect(salaryText(salary)).toBe(text);
    expect(salaryOf(text)).toEqual(salary);
  });

  it.each([
    { text: '2000 usd', salary: { salaryMin: 2000, salaryMax: 2000, currency: 'USD' } },
    { text: '1 500 – 2 500 USD', salary: { salaryMin: 1500, salaryMax: 2500, currency: 'USD' } },
    { text: '3000', salary: { salaryMin: 3000, salaryMax: 3000, currency: null } },
  ])('reads the sheet salary $text', ({ text, salary }) => {
    expect(salaryOf(text)).toEqual(salary);
  });

  it.each(['about 2k', '1500-2500 dollars', '1500-2500-3000'])('cannot read %s', (text) => {
    expect(salaryOf(text)).toBeUndefined();
  });
});

describe('stageHistoryText and stageHistoryOf', () => {
  it.each<{ name: string; history: ImportedStageEvent[]; text: string }>([
    {
      name: 'a rejection after screening',
      history: [
        { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
        { toStage: 'screening', reasonCode: null, occurredAt: '2026-10-03T09:00:00.000Z' },
        { toStage: 'rejected', reasonCode: 'skills_gap', occurredAt: '2026-10-07T15:30:00.000Z' },
      ],
      text: 'applied@2026-10-01T09:00:00.000Z;screening@2026-10-03T09:00:00.000Z;rejected@2026-10-07T15:30:00.000Z:skills_gap',
    },
    {
      name: 'a ghosted card revived to screening',
      history: [
        { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
        { toStage: 'screening', reasonCode: null, occurredAt: '2026-10-02T09:00:00.000Z' },
        {
          toStage: 'ghosted',
          reasonCode: 'silence_timeout',
          occurredAt: '2026-10-20T09:00:00.000Z',
        },
        { toStage: 'screening', reasonCode: null, occurredAt: '2026-10-25T09:00:00.000Z' },
      ],
      text: 'applied@2026-10-01T09:00:00.000Z;screening@2026-10-02T09:00:00.000Z;ghosted@2026-10-20T09:00:00.000Z:silence_timeout;screening@2026-10-25T09:00:00.000Z',
    },
  ])('writes $name and reads it back unchanged', ({ history, text }) => {
    expect(stageHistoryText(history)).toBe(text);
    expect(stageHistoryOf(text)).toEqual(history);
  });

  it('skips blank entries and keeps an entry it cannot read for the row check to refuse', () => {
    expect(stageHistoryOf(' applied@2026-10-01T09:00:00.000Z ; ;screening ;')).toEqual([
      { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
      'screening',
    ]);
  });
});

describe('importedInstantOf', () => {
  it.each([
    { text: '2026-10-01T09:00:00.000Z', instant: '2026-10-01T09:00:00.000Z' },
    { text: '2026-10-01T12:00:00+03:00', instant: '2026-10-01T09:00:00.000Z' },
    { text: '2026-10-01', instant: '2026-09-30T21:00:00.000Z' },
    { text: '15.11.2026', instant: '2026-11-14T22:00:00.000Z' },
    { text: '1.3.2026', instant: '2026-02-28T22:00:00.000Z' },
  ])('reads $text in Kyiv as $instant', ({ text, instant }) => {
    expect(importedInstantOf(text, KYIV)).toBe(instant);
  });

  it('reads a day alone at the start of that day in the zone it is given', () => {
    expect(importedInstantOf('2026-10-01', 'America/New_York')).toBe('2026-10-01T04:00:00.000Z');
  });

  it.each(['31.02.2026', '2026-13-01', 'вчора', '10/01/2026'])(
    'keeps %s as written for the row check to refuse',
    (text) => {
      expect(importedInstantOf(text, KYIV)).toBe(text);
    },
  );
});
