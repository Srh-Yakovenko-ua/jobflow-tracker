import { describe, expect, it } from 'vitest';

import {
  APPLICATION_CSV_HEADER,
  autoMappingOf,
  IMPORT_TEMPLATE,
  importCandidateOf,
} from './application-csv.js';
import { parseCsv, toCsv } from './csv.js';
import { importRowSchemaAt } from './schemas/application-import.js';
import { issuePathsOf } from './test/zod-issues.js';

const KYIV = 'Europe/Kyiv';

const rowSchema = importRowSchemaAt(new Date('2026-11-15T12:00:00.000Z'));

const EXPORT_MAPPING = autoMappingOf(APPLICATION_CSV_HEADER);

const candidateOf = (cells: readonly string[]) =>
  importCandidateOf(cells, { mapping: EXPORT_MAPPING, timeZone: KYIV });

const SHEET_ROW = ['Vela', 'Frontend Engineer', '', '2026-10-01', '', '', '', ''];

const sheetRowWith = (column: number, text: string) =>
  SHEET_ROW.map((cell, index) => (index === column ? text : cell));

describe('APPLICATION_CSV_HEADER', () => {
  it('names the template columns in their order', () => {
    expect(APPLICATION_CSV_HEADER).toEqual([
      'company',
      'position',
      'source',
      'applied_at',
      'stage',
      'salary',
      'url',
      'stage_history',
    ]);
  });
});

describe('autoMappingOf', () => {
  it('maps a header equal to a field key, a column name or a label, and leaves the rest', () => {
    expect(
      autoMappingOf([
        'Компанія',
        ' посада ',
        'Дата відгуку',
        'Нотатки',
        'Stage',
        'salary',
        'stageHistory',
      ]),
    ).toEqual({ company: 0, position: 1, appliedAt: 2, stage: 4, salary: 5, stageHistory: 6 });
  });

  it('maps the exported header to every field', () => {
    expect(EXPORT_MAPPING).toEqual({
      company: 0,
      position: 1,
      source: 2,
      appliedAt: 3,
      stage: 4,
      salary: 5,
      url: 6,
      stageHistory: 7,
    });
  });
});

describe('importCandidateOf', () => {
  it('reads an exported row with codes, a guarded formula, a salary and a history', () => {
    const cells = [
      "'=Acme",
      'Node.js Engineer',
      'djinni',
      '2026-10-01T09:00:00.000Z',
      'rejected',
      '1500-2500 USD',
      'https://djinni.co/jobs/42',
      'applied@2026-10-01T09:00:00.000Z;rejected@2026-10-04T09:00:00.000Z:skills_gap',
    ];
    expect(rowSchema.parse(candidateOf(cells))).toEqual({
      company: '=Acme',
      position: 'Node.js Engineer',
      source: 'djinni',
      appliedAt: '2026-10-01T09:00:00.000Z',
      stage: 'rejected',
      salaryMin: 1500,
      salaryMax: 2500,
      currency: 'USD',
      url: 'https://djinni.co/jobs/42',
      stageHistory: [
        { toStage: 'applied', reasonCode: null, occurredAt: '2026-10-01T09:00:00.000Z' },
        { toStage: 'rejected', reasonCode: 'skills_gap', occurredAt: '2026-10-04T09:00:00.000Z' },
      ],
    });
  });

  it('reads a sheet row with empty cells as applied from other at the start of the day in the user zone', () => {
    expect(rowSchema.parse(candidateOf(SHEET_ROW))).toEqual({
      company: 'Vela',
      position: 'Frontend Engineer',
      source: 'other',
      appliedAt: '2026-09-30T21:00:00.000Z',
      stage: 'applied',
    });
  });

  it.each([
    { name: 'a stage label', column: 4, text: 'Скринінг', field: { stage: 'screening' } },
    {
      name: 'an English stage label',
      column: 4,
      text: 'Tech interview',
      field: { stage: 'tech_interview' },
    },
    { name: 'a source label', column: 2, text: 'рефералка', field: { source: 'referral' } },
    { name: 'an unknown source', column: 2, text: 'Indeed', field: { source: 'other' } },
    {
      name: 'a dotted date',
      column: 3,
      text: '15.11.2026',
      field: { appliedAt: '2026-11-14T22:00:00.000Z' },
    },
  ])('reads $name', ({ column, text, field }) => {
    const cells = sheetRowWith(column, text);
    expect(rowSchema.parse(candidateOf(cells))).toMatchObject(field);
  });

  it.each([
    { name: 'an unknown stage', column: 4, text: 'interview', path: 'stage' },
    { name: 'a salary it cannot read', column: 5, text: 'about 2k', path: 'salaryMin' },
    { name: 'a date in another format', column: 3, text: '10/01/2026', path: 'appliedAt' },
    { name: 'a history entry without a date', column: 7, text: 'applied', path: 'stageHistory.0' },
    { name: 'an empty company', column: 0, text: '  ', path: 'company' },
  ])('leaves $name for the row check to refuse', ({ column, text, path }) => {
    const cells = sheetRowWith(column, text);
    expect(issuePathsOf(rowSchema.safeParse(candidateOf(cells)))).toEqual([path]);
  });

  it('reads nothing for a field the mapping leaves out or a column the row lacks', () => {
    const mapping = { company: 0, position: 9 };
    expect(importCandidateOf(['Vela', 'QA'], { mapping, timeZone: KYIV })).toEqual({
      company: 'Vela',
    });
  });
});

describe('IMPORT_TEMPLATE', () => {
  it('holds the header and one example row that imports once written and read back', () => {
    const [header = [], ...rows] = parseCsv(toCsv(IMPORT_TEMPLATE));
    const mapping = autoMappingOf(header);

    expect(header).toEqual(APPLICATION_CSV_HEADER);
    expect(rows).toHaveLength(1);
    expect(
      rows.map(
        (cells) =>
          rowSchema.safeParse(importCandidateOf(cells, { mapping, timeZone: KYIV })).success,
      ),
    ).toEqual([true]);
  });
});
