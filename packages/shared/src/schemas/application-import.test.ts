import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import {
  IMPORT_LIMITS,
  importApplicationsInputSchema,
  importApplicationsResponseSchema,
  importRowSchemaAt,
} from './application-import.js';

const NOW = new Date('2026-11-15T12:00:00.000Z');

const rowSchema = importRowSchemaAt(NOW);

const ROW = {
  company: 'Vela',
  position: 'Frontend Engineer',
  appliedAt: '2026-10-01T09:00:00.000Z',
};

const HISTORY = [
  { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
  { toStage: 'screening', reasonCode: null, occurredAt: '2026-10-03T09:00:00.000Z' },
  { toStage: 'rejected', reasonCode: 'skills_gap', occurredAt: '2026-10-03T09:00:00.000Z' },
];

describe('importRowSchemaAt', () => {
  it('fills source other and stage applied for a row with the three required fields', () => {
    expect(rowSchema.parse(ROW)).toEqual({ ...ROW, source: 'other', stage: 'applied' });
  });

  it('keeps a full row with salary, link and a history ending in a rejection', () => {
    const row = {
      ...ROW,
      source: 'djinni',
      stage: 'rejected',
      salaryMin: 1500,
      salaryMax: 2500,
      currency: 'USD',
      url: 'https://djinni.co/jobs/42',
      stageHistory: HISTORY,
    };
    expect(rowSchema.parse(row)).toEqual(row);
  });

  it('accepts an applied date equal to now', () => {
    expect(rowSchema.safeParse({ ...ROW, appliedAt: NOW.toISOString() }).success).toBe(true);
  });

  it.each([
    { label: 'no company', row: { ...ROW, company: undefined }, path: 'company' },
    {
      label: 'a company of 201 characters',
      row: { ...ROW, company: 'x'.repeat(201) },
      path: 'company',
    },
    { label: 'a blank position', row: { ...ROW, position: '   ' }, path: 'position' },
    { label: 'no applied date', row: { ...ROW, appliedAt: undefined }, path: 'appliedAt' },
    {
      label: 'an applied date 1 ms in the future',
      row: { ...ROW, appliedAt: '2026-11-15T12:00:00.001Z' },
      path: 'appliedAt',
    },
    {
      label: 'an applied day without a time',
      row: { ...ROW, appliedAt: '2026-10-01' },
      path: 'appliedAt',
    },
    {
      label: 'an applied date it cannot read once, without a future date issue',
      row: { ...ROW, appliedAt: '31.09.2026' },
      path: 'appliedAt',
    },
    {
      label: 'a history date it cannot read once, without a future date issue',
      row: { ...ROW, stageHistory: [HISTORY[0], { ...HISTORY[1], occurredAt: '31.09.2026' }] },
      path: 'stageHistory.1.occurredAt',
    },
    { label: 'an unknown stage', row: { ...ROW, stage: 'interview' }, path: 'stage' },
    { label: 'an unknown source', row: { ...ROW, source: 'indeed' }, path: 'source' },
    {
      label: 'a salary from above the salary to',
      row: { ...ROW, salaryMin: 3000, salaryMax: 2000 },
      path: 'salaryMin',
    },
    {
      label: 'a salary that is not a number',
      row: { ...ROW, salaryMin: '1500 USD' },
      path: 'salaryMin',
    },
    { label: 'a lowercase currency', row: { ...ROW, currency: 'usd' }, path: 'currency' },
    { label: 'an ftp link', row: { ...ROW, url: 'ftp://vela.example/42' }, path: 'url' },
    {
      label: 'a history that starts at screening',
      row: { ...ROW, stageHistory: HISTORY.slice(1) },
      path: 'stageHistory.0.toStage',
    },
    {
      label: 'a history whose second date is before the first',
      row: {
        ...ROW,
        stageHistory: [HISTORY[0], { ...HISTORY[1], occurredAt: '2026-09-30T09:00:00.000Z' }],
      },
      path: 'stageHistory.1.occurredAt',
    },
    {
      label: 'a history event in the future',
      row: {
        ...ROW,
        stageHistory: [HISTORY[0], { ...HISTORY[1], occurredAt: '2026-11-16T00:00:00.000Z' }],
      },
      path: 'stageHistory.1.occurredAt',
    },
    {
      label: 'a reason on a screening event',
      row: { ...ROW, stageHistory: [HISTORY[0], { ...HISTORY[1], reasonCode: 'skills_gap' }] },
      path: 'stageHistory.1.reasonCode',
    },
    {
      label: 'an unknown reason code',
      row: { ...ROW, stageHistory: [HISTORY[0], { ...HISTORY[2], reasonCode: 'bored' }] },
      path: 'stageHistory.1.reasonCode',
    },
    { label: 'an empty history', row: { ...ROW, stageHistory: [] }, path: 'stageHistory' },
  ])('refuses $label', ({ row, path }) => {
    expect(issuePathsOf(rowSchema.safeParse(row))).toEqual([path]);
  });
});

describe('importApplicationsInputSchema', () => {
  it('takes rows it cannot read yet, so one bad row never refuses the batch', () => {
    const body = { rows: [ROW, { company: 1 }, 'not a row'] };
    expect(importApplicationsInputSchema.parse(body)).toEqual(body);
  });

  it.each([
    { label: 'no rows', rows: [] },
    { label: '501 rows', rows: Array.from({ length: IMPORT_LIMITS.rowsMax + 1 }, () => ROW) },
  ])('refuses $label', ({ rows }) => {
    expect(issuePathsOf(importApplicationsInputSchema.safeParse({ rows }))).toEqual(['rows']);
  });

  it('takes 500 rows', () => {
    const rows = Array.from({ length: 500 }, () => ROW);
    expect(importApplicationsInputSchema.safeParse({ rows }).success).toBe(true);
  });
});

describe('importApplicationsResponseSchema', () => {
  it('keeps the imported count with each refused row, its path and message', () => {
    const response = {
      imported: 2,
      errors: [{ row: 3, path: 'appliedAt', message: 'appliedAt must not be in the future' }],
    };
    expect(importApplicationsResponseSchema.parse(response)).toEqual(response);
  });

  it('refuses a negative row index', () => {
    const response = { imported: 0, errors: [{ row: -1, path: 'company', message: 'Required' }] };
    expect(issuePathsOf(importApplicationsResponseSchema.safeParse(response))).toEqual([
      'errors.0.row',
    ]);
  });
});
