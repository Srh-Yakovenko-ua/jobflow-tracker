import {
  codeNamedBy,
  importedInstantOf,
  salaryOf,
  stageHistoryOf,
} from './application-csv-cells.js';
import { type CsvTable, unguardedCellOf } from './csv.js';
import type { LocalizedLabel } from './labels.js';
import {
  IMPORT_FIELDS,
  type ImportField,
  type ImportRowInput,
} from './schemas/application-import.js';
import { SOURCE_LABELS, SOURCES } from './sources.js';
import { STAGE_LABELS, STAGES } from './stages.js';

export type ImportMapping = Partial<Record<ImportField, number>>;

export type ImportCandidate = Partial<Record<keyof ImportRowInput, unknown>>;

export type ImportCandidateOptions = Readonly<{ mapping: ImportMapping; timeZone: string }>;

export const IMPORT_FIELD_COLUMNS: Record<ImportField, string> = {
  company: 'company',
  position: 'position',
  source: 'source',
  appliedAt: 'applied_at',
  stage: 'stage',
  salary: 'salary',
  url: 'url',
  stageHistory: 'stage_history',
};

export const IMPORT_FIELD_LABELS: Record<ImportField, LocalizedLabel> = {
  company: { labelUk: 'Компанія', labelEn: 'Company' },
  position: { labelUk: 'Посада', labelEn: 'Position' },
  source: { labelUk: 'Джерело', labelEn: 'Source' },
  appliedAt: { labelUk: 'Дата відгуку', labelEn: 'Applied date' },
  stage: { labelUk: 'Етап', labelEn: 'Stage' },
  salary: { labelUk: 'Зарплата', labelEn: 'Salary' },
  url: { labelUk: 'Посилання', labelEn: 'Link' },
  stageHistory: { labelUk: 'Історія етапів', labelEn: 'Stage history' },
};

export const APPLICATION_CSV_HEADER: readonly string[] = IMPORT_FIELDS.map(
  (field) => IMPORT_FIELD_COLUMNS[field],
);

export const IMPORT_TEMPLATE: CsvTable = {
  header: APPLICATION_CSV_HEADER,
  rows: [
    [
      'Vela',
      'Frontend Engineer',
      'djinni',
      '2026-10-01',
      'screening',
      '1500-2500 USD',
      'https://djinni.co/jobs/42',
      'applied@2026-10-01T09:00:00.000Z;screening@2026-10-03T09:00:00.000Z',
    ],
  ],
};

const labelNamesOf = ({ labelUk, labelEn }: LocalizedLabel) => [labelUk, labelEn];

const fieldNamesOf = (field: ImportField) => [
  field,
  IMPORT_FIELD_COLUMNS[field],
  ...labelNamesOf(IMPORT_FIELD_LABELS[field]),
];

export function autoMappingOf(header: readonly string[]): ImportMapping {
  const named = header.map((text) =>
    codeNamedBy({ text, codes: IMPORT_FIELDS, namesOf: fieldNamesOf }),
  );
  return Object.fromEntries(
    IMPORT_FIELDS.flatMap((field) => {
      const index = named.indexOf(field);
      return index === -1 ? [] : [[field, index]];
    }),
  );
}

type LabelledCodes<Code extends string> = Readonly<{
  codes: readonly Code[];
  labels: Record<Code, LocalizedLabel>;
}>;

function labelledCodeOf<Code extends string>(text: string, { codes, labels }: LabelledCodes<Code>) {
  return codeNamedBy({ text, codes, namesOf: (code) => [code, ...labelNamesOf(labels[code])] });
}

type CellReader = (text: string, timeZone: string) => ImportCandidate;

const CELL_READERS: Record<ImportField, CellReader> = {
  company: (text) => ({ company: text }),
  position: (text) => ({ position: text }),
  source: (text) => ({
    source: labelledCodeOf(text, { codes: SOURCES, labels: SOURCE_LABELS }) ?? 'other',
  }),
  appliedAt: (text, timeZone) => ({ appliedAt: importedInstantOf(text, timeZone) }),
  stage: (text) => ({
    stage: labelledCodeOf(text, { codes: STAGES, labels: STAGE_LABELS }) ?? text,
  }),
  salary: (text) => salaryOf(text) ?? { salaryMin: text },
  url: (text) => ({ url: text }),
  stageHistory: (text) => ({ stageHistory: stageHistoryOf(text) }),
};

function cellTextOf(cells: readonly string[], index: number | undefined): string {
  return index === undefined ? '' : unguardedCellOf((cells[index] ?? '').trim());
}

export function importCandidateOf(
  cells: readonly string[],
  { mapping, timeZone }: ImportCandidateOptions,
): ImportCandidate {
  return IMPORT_FIELDS.reduce<ImportCandidate>((candidate, field) => {
    const text = cellTextOf(cells, mapping[field]);
    return text === '' ? candidate : { ...candidate, ...CELL_READERS[field](text, timeZone) };
  }, {});
}
