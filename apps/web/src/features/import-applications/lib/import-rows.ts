import {
  FUTURE_DATE_ISSUE,
  IMPORT_FIELDS,
  IMPORT_LIMITS,
  type ImportCandidate,
  importCandidateOf,
  type ImportField,
  importFieldSchema,
  type ImportMapping,
  type ImportRowError,
  importRowSchemaAt,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import type { ImportSheet } from './import-file';

export type ImportDraft = Readonly<{
  sheet: ImportSheet;
  mapping: ImportMapping;
  timeZone: string;
}>;

type CheckedDraft = ImportDraft & Readonly<{ now: Date }>;

export type PreviewRow = Readonly<{
  line: number;
  cells: Partial<Record<ImportField, string>>;
  issues: readonly ImportField[];
  problems: readonly string[];
  valid: boolean;
}>;

type RowIssue = Pick<ImportRowError, 'path' | 'message'>;

const SALARY_PATHS = new Set(['salaryMin', 'salaryMax', 'currency']);

const HEADER_LINES = 1;

export function lineOfRow(row: number): number {
  return row + HEADER_LINES + 1;
}

export function fieldOfPath(path: string): ImportField | null {
  const head = path.split('.')[0] ?? '';
  if (SALARY_PATHS.has(head)) return 'salary';
  return importFieldSchema.safeParse(head).data ?? null;
}

export function issueTextOf({ path, message }: RowIssue): string {
  const field = fieldOfPath(path);
  if (field === null) return uk.dataImport.invalidRow;
  if (field === 'appliedAt' && message === FUTURE_DATE_ISSUE.error) return uk.dataImport.futureDate;
  return uk.dataImport.issues[field];
}

export function candidatesOf({ sheet, mapping, timeZone }: ImportDraft): ImportCandidate[] {
  return sheet.rows.map((cells) => importCandidateOf(cells, { mapping, timeZone }));
}

export function validCountOf({ now, ...draft }: CheckedDraft): number {
  const schema = importRowSchemaAt(now);
  return candidatesOf(draft).filter((candidate) => schema.safeParse(candidate).success).length;
}

function mappedCellsOf(cells: readonly string[], mapping: ImportMapping) {
  return Object.fromEntries(
    IMPORT_FIELDS.flatMap((field) => {
      const index = mapping[field];
      return index === undefined ? [] : [[field, cells[index] ?? '']];
    }),
  );
}

export function previewOf(draft: CheckedDraft): PreviewRow[] {
  const schema = importRowSchemaAt(draft.now);
  const candidates = candidatesOf(draft).slice(0, IMPORT_LIMITS.previewRows);
  return candidates.map((candidate, row) => {
    const parsed = schema.safeParse(candidate);
    const issues = (parsed.error?.issues ?? []).map(({ path, message }) => ({
      path: path.join('.'),
      message,
    }));
    const broken = new Set(issues.map((issue) => fieldOfPath(issue.path)));
    return {
      line: lineOfRow(row),
      cells: mappedCellsOf(draft.sheet.rows[row] ?? [], draft.mapping),
      issues: IMPORT_FIELDS.filter((field) => broken.has(field)),
      problems: [...new Set(issues.map(issueTextOf))],
      valid: parsed.success,
    };
  });
}
